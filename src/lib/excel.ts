import ExcelJS from 'exceljs';
import * as fs from 'fs';
import { getConfig, getProductById, Product } from './config';
import { formatToExcelTimestamp, getNow } from './date-utils';

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
    sheet.eachRow({ includeEmpty: true }, (row, _rowNumber) => {
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
        sheet.eachRow({ includeEmpty: true }, (row, _rowNumber) => {
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

        // Map row data to objects
        const orders: Order[] = [];
        for (let i = 2; i < rawData.length; i++) {
            const row = rawData[i] as (string | number | null)[];
            if (!row || row.length === 0) continue;

            const woIdIdx = headers.indexOf('WO ID');
            const woId = row[woIdIdx] ?? '';

            if (!woId) continue; // Skip rows without WO ID

            const getColVal = (name: string) => {
                const idx = headers.indexOf(name);
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

// Update order step for a specific product
export async function updateOrderStep(woId: string, step: string, status: string, operatorId?: string, productId?: string): Promise<Order | null> {
    const config = getConfig();

    let product: Product | null;
    if (productId) {
        product = getProductById(productId);
    } else {
        product = config.products.find(p => p.id === config.activeProductId) || config.products[0];
    }

    if (!product || !product.excelPath) throw new Error('No product configured');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(product.excelPath);
    const sheet = findWorksheet(workbook);

    const headerRow = sheet.getRow(1);
    const headers: { [key: string]: number } = {};
    headerRow.eachCell((cell, colNumber) => {
        headers[String(cell.text || cell.value).trim()] = colNumber;
    });

    let targetRowNumber = -1;
    const woIdCol = headers['WO ID'];

    if (!woIdCol) throw new Error('WO ID columns not found');

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const cell = row.getCell(woIdCol);
        if (String(cell.value) === woId) {
            targetRowNumber = rowNumber;
        }
    });

    if (targetRowNumber === -1) {
        throw new Error(`Order ${woId} not found`);
    }

    let cellValue: string;
    if (status === 'Done') {
        const now = getNow();
        const formatted = formatToExcelTimestamp(now);
        cellValue = operatorId ? `${formatted} (ID: ${operatorId})` : formatted;
    } else if (status === 'Reset') {
        cellValue = '';
    } else {
        cellValue = status;
    }

    const stepCol = headers[step];
    if (stepCol === undefined) throw new Error(`Step ${step} not found`);

    const targetRow = sheet.getRow(targetRowNumber);
    const targetCell = targetRow.getCell(stepCol);
    targetCell.value = cellValue;

    await workbook.xlsx.writeFile(product.excelPath);

    const { orders } = await readOrders(productId);
    return orders.find(o => o['WO ID'] === woId) || null;
}

export async function updateOrderStepsBatch(updates: StepUpdate[], operatorId?: string, productId?: string): Promise<void> {
    const config = getConfig();
    let product: Product | null;
    if (productId) {
        product = getProductById(productId);
    } else {
        product = config.products.find(p => p.id === config.activeProductId) || config.products[0];
    }

    if (!product || !product.excelPath) throw new Error('Product not configured');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(product.excelPath);
    const sheet = findWorksheet(workbook);

    const headerRow = sheet.getRow(1);
    const headers: { [key: string]: number } = {};
    headerRow.eachCell((cell, colNumber) => {
        headers[String(cell.text || cell.value).trim()] = colNumber;
    });

    const woIdCol = headers['WO ID'] ?? 0;
    const woRowMap: Record<string, number> = {};

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const cell = row.getCell(woIdCol);
        woRowMap[String(cell.value)] = rowNumber;
    });

    updates.forEach(update => {
        const r = woRowMap[update.woId];
        const c = headers[update.step];
        if (r !== undefined && c !== undefined) {
            let cellValue = update.status;
            if (update.status === 'Reset') {
                cellValue = '';
            }
            const row = sheet.getRow(r);
            const cell = row.getCell(c);
            cell.value = cellValue;
        }
    });

    await workbook.xlsx.writeFile(product.excelPath);
}
