'use server';

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'supervisor')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { productId, outputPath } = body;

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        // Query product from Prisma database (instead of config file)
        const dbProduct = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!dbProduct) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Parse the JSON config stored in the product record
        const productConfig = JSON.parse(dbProduct.config);

        // Build column headers: Title row (empty) + Headers row
        const detailColumns = productConfig.detailColumns || ['WO ID', 'PN', 'Description', 'WO DUE', 'Priority'];
        const stepColumns = productConfig.steps || [];
        const allColumns = [...detailColumns, ...stepColumns];

        if (allColumns.length === 0) {
            return NextResponse.json({ error: 'No columns defined for this product' }, { status: 400 });
        }

        // Create workbook with proper structure using ExcelJS
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Schedule');

        // Row 1: Title row (product name)
        sheet.addRow([dbProduct.name + ' - Production Schedule']);

        // Row 2: Headers
        const headerRow = sheet.addRow(allColumns);

        // Row 3: Empty data row (placeholder)
        sheet.addRow(Array(allColumns.length).fill(''));

        // Set column widths
        allColumns.forEach((col, index) => {
            const width = Math.max(col.length + 2, 12);
            sheet.getColumn(index + 1).width = width;
        });

        // Determine output path
        let finalPath = outputPath;
        if (!finalPath) {
            // Default to data directory with product name
            const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
            const safeName = dbProduct.name.replace(/[^a-zA-Z0-9]/g, '_');
            finalPath = path.join(dataDir, `${safeName}_template.xlsx`);
        }

        // Ensure directory exists
        const dir = path.dirname(finalPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Write Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        fs.writeFileSync(finalPath, buffer as any);

        // Update product config in Prisma database with the new excelPath
        const updatedConfig = { ...productConfig, excelPath: finalPath };
        await prisma.product.update({
            where: { id: productId },
            data: { config: JSON.stringify(updatedConfig) }
        });

        return NextResponse.json({
            success: true,
            path: finalPath,
            columns: allColumns.length,
            message: `Excel template created with ${detailColumns.length} detail columns and ${stepColumns.length} step columns`
        });
    } catch (error) {
        console.error('Error creating Excel template:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to create Excel template'
        }, { status: 500 });
    }
}
