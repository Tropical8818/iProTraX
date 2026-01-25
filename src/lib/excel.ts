import ExcelJS from 'exceljs';
import * as fs from 'fs';
import { getConfig, getProductById, Product } from './config';
import { formatToExcelTimestamp, getNow } from './date-utils';
import { getDefaultMappings } from './columnMapping';

// Columns that are NOT process steps
const NON_STEP_COLUMNS = ['WO ID', 'PN', 'Description', 'Remarks', 'Type', 'QCP', 'WO DUE', 'Priority', ' Priority'];

export interface Order {
    id: string;
    'WO ID': string;
    'PN': string;
    'Description': string;
    'WO DUE': string;
    'Priority': string;
    [key: string]: string | undefined;
}

export interface StepUpdate {
    woId: string;
    step: string;
    status: string;
}

export interface ExcelData {
    orders: Order[];
    steps: string[];
    detailColumns?: string[];
}

// Helper to find the correct worksheet
function findWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const sheetName = workbook.worksheets.find(ws => {
        const name = ws.name.toLowerCase();
        return name.includes('schedule') || name.includes('master') || name.includes('dashboard');
    })?.name || workbook.worksheets[0].name;

    return workbook.getWorksheet(sheetName)!;
}

// Reusable helper to parse Excel buffer -> raw array of arrays (like sheet_to_json header:1)
export async function parseExcelBuffer(buffer: Buffer): Promise<{ sheetName: string; rawData: unknown[][] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = findWorksheet(workbook);
    const rawData: unknown[][] = [];

    // ExcelJS is 1-based. We want to return 0-indexed array where index 0 = Row 1
    sheet.eachRow({ includeEmpty: true }, (row) => {
        const rowValues = row.values;
        if (Array.isArray(rowValues)) {
            // row.values has a dummy item at index 0, so slice(1) gets correct columns A, B, C...
            rawData.push(rowValues.slice(1));
        } else if (typeof rowValues === 'object') {
            rawData.push(Object.values(rowValues));
        }
    });

    // Handle case where eachRow might miss if sheet is weird?
    // Usually eachRow is fine.
    // If rawData is empty try manual fetch of first few rows?
    if (rawData.length === 0 && sheet.rowCount > 0) {
        // Try brute force first 10 rows
        for (let i = 1; i <= Math.min(sheet.rowCount, 10); i++) {
            const val = sheet.getRow(i).values;
            if (Array.isArray(val)) rawData.push(val.slice(1));
        }
    }

    return { sheetName: sheet.name, rawData };
}

// Read orders for a specific product (or active product if not specified)
export async function readOrders(productId?: string): Promise<ExcelData> {
    const config = getConfig(); // Config is sync

    // Get product config
    let product: Product | null;
    if (productId) {
        product = getProductById(productId);
    } else {
        product = config.products.find(p => p.id === config.activeProductId) || config.products[0];
    }

    if (!product) {
        throw new Error('No product configured');
    }

    if (!product.excelPath) {
        throw new Error(`Excel file path not configured for product: ${product.name} `);
    }

    if (!fs.existsSync(product.excelPath)) {
        throw new Error(`Excel file not found: ${product.excelPath} `);
    }

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(product.excelPath);

        const sheet = findWorksheet(workbook);

        // Convert sheet to array of arrays to mimic sheet_to_json({header: 1})
        const rawData: unknown[][] = [];
        sheet.eachRow({ includeEmpty: true }, (row) => {
            const rowValues = row.values;
            if (Array.isArray(rowValues)) {
                // slice(1) because exceljs row.values has a dummy item at index 0
                rawData.push(rowValues.slice(1));
            } else if (typeof rowValues === 'object') {
                rawData.push(Object.values(rowValues));
            }
        });

        // Fallback for empty sheet reading
        if (rawData.length === 0 && sheet.rowCount >= 1) {
            const r1 = sheet.getRow(1).values as unknown[];
            if (Array.isArray(r1)) rawData.push(r1.slice(1));
        }

        if (rawData.length < 2) {
            return { orders: [], steps: product.steps || [] };
        }

        // Row 2 (index 1 in rawData) contains headers
        const headers = (rawData[1] as (string | null)[]).map(h => h ? String(h).trim() : '');

        // Use product-configured steps if available, otherwise auto-detect
        let steps: string[];
        if (product.steps && product.steps.length > 0) {
            steps = product.steps.filter(s => headers.includes(s));
        } else {
            // Auto-detect steps from headers
            steps = headers.filter(h =>
                h &&
                !NON_STEP_COLUMNS.includes(h) &&
                h.length > 0 &&
                !h.includes('null')
            );
        }

        // Get detailColumns from product config (or use defaults)
        const detailColumns = product.detailColumns && product.detailColumns.length > 0
            ? product.detailColumns.filter(c => headers.includes(c))
            : NON_STEP_COLUMNS.filter(c => headers.includes(c));

        // Helper to get column index with aliases
        const mappings = getDefaultMappings();
        const getColIndex = (name: string): number => {
            // Try exact match
            let idx = headers.indexOf(name);
            if (idx >= 0) return idx;

            // Try aliases
            const aliases = mappings[name];
            if (aliases) {
                for (const alias of aliases) {
                    idx = headers.indexOf(alias);
                    if (idx >= 0) return idx;
                }
            }

            // Try case-insensitive
            const lowerName = name.toLowerCase();
            idx = headers.findIndex(h => h.toLowerCase() === lowerName);
            if (idx >= 0) return idx;

            return -1;
        };

        // Map row data to objects
        const orders: Order[] = [];
        for (let i = 2; i < rawData.length; i++) {
            const row = rawData[i] as (string | number | null)[];
            if (!row || row.length === 0) continue;

            const woIdIdx = getColIndex('WO ID');
            const woId = woIdIdx >= 0 ? row[woIdIdx] ?? '' : '';

            if (!woId) continue; // Skip rows without WO ID

            const getColVal = (name: string) => {
                const idx = getColIndex(name);
                return idx >= 0 ? row[idx] : undefined;
            };

            const order: Order = {
                id: String(woId),
                'WO ID': String(woId),
                'PN': String(getColVal('PN') ?? ''),
                'Description': String(getColVal('Description') ?? ''),
                'WO DUE': formatExcelDate(getColVal('WO DUE')),
                'Priority': String(getColVal(' Priority') ?? getColVal('Priority') ?? ''),
            };

            // Add all detail columns from config
            detailColumns.forEach(col => {
                const val = getColVal(col);
                if (val !== undefined && !order[col]) {
                    order[col] = formatCellValue(val);
                }
            });

            // Add all step columns
            steps.forEach(step => {
                const val = getColVal(step);
                if (val !== undefined) {
                    order[step] = formatCellValue(val);
                }
            });

            orders.push(order);
        }

        return { orders, steps, detailColumns };
    } catch (err) {
        throw new Error(`Failed to read Excel file: ${err instanceof Error ? err.message : 'Unknown error'} `);
    }
}

// Convert Excel serial date to readable string
function formatExcelDate(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
            return date.toISOString().slice(0, 10);
        }
    }
    return String(value);
}

// Format cell value - handle dates and strings
function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) {
        return value.toISOString().slice(0, 16).replace('T', ' ');
    }
    if (typeof value === 'number') {
        if (value > 40000 && value < 60000) {
            const date = new Date((value - 25569) * 86400 * 1000);
            if (!isNaN(date.getTime())) {
                return date.toISOString().slice(0, 16).replace('T', ' ');
            }
        }
        return String(value);
    }
    if (typeof value === 'object' && 'richText' in value) {
        return (value as any).richText.map((t: any) => t.text).join('');
    }
    if (typeof value === 'object' && 'text' in value) {
        return (value as any).text;
    }
    return String(value);
}

// Update functions removed to ensure Excel is treated as Read-Only / Import Template.
// All status updates are persisted to the Database (Prisma/Postgres) only.
