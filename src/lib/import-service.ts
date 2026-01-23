/**
 * Reusable Excel Import Service
 * Handles parsing Excel files and upserting order data to the database.
 * Used by both the API route and the file watcher for automatic imports.
 */

import { prisma } from '@/lib/prisma';
import { parseExcelBuffer } from '@/lib/excel';
import * as fs from 'fs';
import { normalizeHeaders, getDefaultMappings, validateRequiredColumns, type ColumnMappings } from '@/lib/columnMapping';
import { validateOrderData, getDefaultValidationRules, type ValidationRules, type ValidationError } from '@/lib/validation';
import { formatToShortTimestamp, getNow, excelSerialToDate, formatToExcelTimestamp, formatToDateOnly } from '@/lib/date-utils';

export interface ImportOptions {
    productId: string;
    mode?: 'update' | 'skip-existing';  // 'update' merges data, 'skip-existing' ignores existing orders
}

export interface ImportResult {
    success: boolean;
    imported: number;
    updated: number;
    skipped: number;
    validationErrors: number;
    errors: ValidationError[];
    headers: string[];
    detectedHeaders: string[];
    headerMapping: Record<string, string>;
    sheetName: string;
    mode: string;
    error?: string;
}

/**
 * Import orders from an Excel file buffer
 */
export async function importFromBuffer(buffer: Buffer, options: ImportOptions): Promise<ImportResult> {
    const { productId, mode = 'update' } = options;

    // Fetch product configuration
    const product = await prisma.product.findUnique({
        where: { id: productId }
    });

    if (!product) {
        return createErrorResult('Product not found');
    }

    // Parse product config
    const config = JSON.parse(product.config);
    const columnMappings: ColumnMappings = config.columnMappings || getDefaultMappings();
    const validationRules: ValidationRules = config.validationRules || getDefaultValidationRules();

    // Read the Excel file using shared helper
    let sheetName = '';
    let rawData: unknown[][] = [];

    try {
        const parsed = await parseExcelBuffer(buffer);
        sheetName = parsed.sheetName;
        rawData = parsed.rawData;
    } catch (e) {
        return createErrorResult(`Failed to parse Excel: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (rawData.length < 2) {
        return createErrorResult('Excel file must have at least 2 rows');
    }

    // Row 2 (index 1) contains headers
    const detectedHeaders = (rawData[1] as (string | null)[])
        .map(h => h ? String(h).trim() : '')
        .filter(h => h && h.length > 0 && !h.includes('null') && !h.toLowerCase().includes('unnamed'));

    // Apply column mapping
    const { normalized: headers, mapping: headerMapping } = normalizeHeaders(detectedHeaders, columnMappings);

    // Validate required columns
    const requiredCheck = validateRequiredColumns(headers, ['WO ID']);
    if (!requiredCheck.valid) {
        return createErrorResult(`Missing required columns: ${requiredCheck.missing.join(', ')}`);
    }

    // Parse data rows (starting from row 3, index 2)
    const dataRows = rawData.slice(2);
    const importedOrders: string[] = [];
    const updatedOrders: string[] = [];
    const skippedOrders: string[] = [];
    const validationErrors: ValidationError[] = [];

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
        const row = dataRows[rowIndex];
        const rowNumber = rowIndex + 3; // Excel row number (header is row 2)
        const rowData: Record<string, string> = {};

        headers.forEach((header, index) => {
            const value = row[index];

            if (value == null || value === '') {
                rowData[header] = '';
                return;
            }

            // Check if value is a number that might be a date (Excel stores dates as numbers)
            // Skip heuristic for columns known to be numeric/integers
            const isNumericColumn = ['priority', 'qty', 'quantity', 'count', 'amount', 'target'].includes(header.toLowerCase());

            if (typeof value === 'number' && value > 1 && !isNumericColumn) {
                // Excel dates: serial 1 = 1/1/1900, 45000 ≈ 2023
                // Reasonable date range: 1 (1900) to 100000 (2173)
                if (value > 1 && value < 100000) {
                    // Convert Excel serial date to JS Date using robust util
                    const jsDate = excelSerialToDate(value);
                    const hasTime = (value % 1) !== 0;

                    if (hasTime) {
                        // Has time component: YYYY-MM-DD HH:mm
                        // We use the full timestamp format to preserve Year and Time
                        rowData[header] = formatToExcelTimestamp(jsDate);
                    } else {
                        // Date only: YYYY-MM-DD
                        // We use YYYY-MM-DD to preserve Year which is critical for Due Dates
                        rowData[header] = formatToDateOnly(jsDate);
                    }
                    return;
                }
            }

            // Otherwise, just convert to string
            rowData[header] = String(value).trim();
        });

        const woId = rowData['WO ID'];
        if (!woId || woId.length === 0) continue; // Skip empty rows

        // Auto-set WO Rel timestamp if column exists and is empty
        const woRelKey = Object.keys(rowData).find(k =>
            k.toLowerCase() === 'wo rel' ||
            k.toLowerCase() === 'wo rel.' ||
            k.toLowerCase() === 'wo released' ||
            k.toLowerCase() === 'release date'
        );

        if (woRelKey && !rowData[woRelKey]) {
            rowData[woRelKey] = formatToShortTimestamp(getNow());
        }

        // Validate row data
        const rowErrors = validateOrderData(rowData, validationRules, rowNumber);
        if (rowErrors.length > 0) {
            validationErrors.push(...rowErrors);
            continue;
        }

        // Separate detail columns from step columns
        const detailData: Record<string, string> = {};
        const steps: string[] = config.steps || [];
        const detailColumns: string[] = config.detailColumns || [];

        // Identify due date and release date keys for more robust selection
        const dueDateKey = Object.keys(rowData).find(k => k.toLowerCase().includes('due') || k.toLowerCase().includes('date') || k.toLowerCase().includes('交期') || k.toLowerCase().includes('到期'));

        // Only keep columns that are in detailColumns OR are WO ID OR are due/release dates
        Object.keys(rowData).forEach(key => {
            const isWordOrderId = key === 'WO ID';
            const isConfiguredDetail = detailColumns.includes(key);
            const isCommonField = key.toLowerCase().includes('customer') ||
                key.toLowerCase().includes('qty') ||
                key.toLowerCase().includes('ecd');
            const isDueDateField = key === dueDateKey ||
                key === 'WO DUE' ||
                headerMapping[key] === 'WO DUE';
            const isReleaseDateField = key === woRelKey ||
                key === 'WO Rel' ||
                headerMapping[key] === 'WO Rel';

            if (isWordOrderId || isConfiguredDetail || isCommonField || isDueDateField || isReleaseDateField) {
                detailData[key] = rowData[key];
            }
        });

        // Check if order already exists
        const existing = await prisma.order.findUnique({
            where: {
                productId_woId: {
                    productId,
                    woId
                }
            }
        });

        // Prepare final order data: details + steps
        const finalOrderData = { ...detailData };

        // Initialize all steps from product config
        steps.forEach((step, index) => {
            if (existing) {
                // If order exists, preserve existing step data
                const existingData = JSON.parse(existing.data);
                finalOrderData[step] = existingData[step] || '';
            } else {
                // For new orders, auto-set first step timestamp
                if (index === 0) {
                    finalOrderData[step] = formatToShortTimestamp(getNow());
                } else {
                    finalOrderData[step] = '';
                }
            }
        });

        if (existing) {
            if (mode === 'skip-existing') {
                skippedOrders.push(woId);
                continue;
            } else {
                // Update: merge new details with existing step progress
                await prisma.order.update({
                    where: { id: existing.id },
                    data: {
                        data: JSON.stringify(finalOrderData)
                    }
                });
                updatedOrders.push(woId);
            }
        } else {
            // Create new order with empty steps
            await prisma.order.create({
                data: {
                    woId,
                    productId,
                    data: JSON.stringify(finalOrderData)
                }
            });
            importedOrders.push(woId);
        }
    }

    return {
        success: true,
        imported: importedOrders.length,
        updated: updatedOrders.length,
        skipped: skippedOrders.length,
        validationErrors: validationErrors.length,
        errors: validationErrors.slice(0, 10),
        headers,
        detectedHeaders,
        headerMapping,
        sheetName,
        mode
    };
}

/**
 * Import orders from an Excel file path (for file watcher usage)
 */
export async function importFromFile(filePath: string, options: ImportOptions): Promise<ImportResult> {
    try {
        const buffer = fs.readFileSync(filePath);
        return await importFromBuffer(buffer, options);
    } catch (error) {
        return createErrorResult(error instanceof Error ? error.message : 'Failed to read file');
    }
}

/**
 * Format a date as dd-MMM, HH:mm
 */
// Removed local function in favor of date-utils


/**
 * Create an error result
 */
function createErrorResult(error: string): ImportResult {
    return {
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        validationErrors: 0,
        errors: [],
        headers: [],
        detectedHeaders: [],
        headerMapping: {},
        sheetName: '',
        mode: '',
        error
    };
}
