/**
 * File Watcher for Automatic Excel Import
 * 
 * Monitors configured watchFolder paths for each product and automatically
 * imports Excel files when they are added or modified.
 * 
 * Usage:
 *   NODE_ENV=development npx tsx scripts/watcher.ts
 *   npm run watcher
 */

import chokidar from 'chokidar';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { importFromFile } from '../src/lib/import-service';

const prisma = new PrismaClient();

interface ProductWatchConfig {
    id: string;
    name: string;
    watchFolder: string;
}

// Use a simple Map for watchers - chokidar.FSWatcher is inferred
const watchers: Map<string, ReturnType<typeof chokidar.watch>> = new Map();

/**
 * Check if a file is an Excel file
 */
function isExcelFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.xlsx', '.xls', '.xlsm'].includes(ext);
}

/**
 * Handle a file change event
 */
async function handleFileChange(filePath: string, productId: string, productName: string) {
    if (!isExcelFile(filePath)) {
        return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📁 Detected file change: ${filePath}`);
    console.log(`[${timestamp}] 🔄 Importing for product: ${productName} (${productId})`);

    try {
        const result = await importFromFile(filePath, {
            productId,
            mode: 'update'  // Changed from 'skip-existing' to allow overlaying updates
        });

        if (result.success) {
            console.log(`[${timestamp}] ✅ Import successful!`);
            console.log(`    - New orders: ${result.imported}`);
            console.log(`    - Updated orders: ${result.updated}`);
            console.log(`    - Skipped: ${result.skipped}`);
            if (result.validationErrors > 0) {
                console.log(`    - Validation errors: ${result.validationErrors}`);
            }
        } else {
            console.error(`[${timestamp}] ❌ Import failed: ${result.error}`);
        }
    } catch (error) {
        console.error(`[${timestamp}] ❌ Import error:`, error);
    }
}

/**
 * Start watching a folder for a product
 */
function startWatching(product: ProductWatchConfig) {
    const { id, name, watchFolder } = product;

    // Stop existing watcher if any
    if (watchers.has(id)) {
        watchers.get(id)?.close();
        watchers.delete(id);
    }

    // Skip if no watch folder configured
    if (!watchFolder || watchFolder.trim() === '') {
        console.log(`⏭️  Product "${name}" has no watchFolder configured, skipping...`);
        return;
    }

    console.log(`👀 Starting watch on: ${watchFolder} (Product: ${name})`);

    const watcher = chokidar.watch(watchFolder, {
        persistent: true,
        ignoreInitial: true,  // Don't process existing files on startup
        awaitWriteFinish: {
            stabilityThreshold: 2000,  // Wait 2s after last change
            pollInterval: 500
        },
        // Only watch Excel files
        ignored: (filePath: string) => {
            const basename = path.basename(filePath);
            // Ignore hidden files, temp files, and non-Excel files
            if (basename.startsWith('.') || basename.startsWith('~$')) {
                return true;
            }
            // For directories, don't ignore (we want to watch subdirectories)
            if (!path.extname(filePath)) {
                return false;
            }
            // For files, only accept Excel extensions
            return !isExcelFile(filePath);
        }
    });

    watcher.on('add', (filePath) => handleFileChange(filePath, id, name));
    watcher.on('change', (filePath) => handleFileChange(filePath, id, name));
    watcher.on('error', (error) => console.error(`Watcher error for ${name}:`, error));

    watchers.set(id, watcher);
}

/**
 * Refresh all watchers based on current product configurations
 */
async function refreshWatchers() {
    console.log('\n🔄 Refreshing product watch configurations...\n');

    try {
        // Fetch all products with watchFolder
        const products = await prisma.product.findMany({
            select: {
                id: true,
                name: true,
                watchFolder: true
            }
        });

        const activeProducts = products.filter(p => p.watchFolder && p.watchFolder.trim() !== '');
        console.log(`Found ${activeProducts.length} products with watchFolder configured.\n`);

        // Close watchers for products no longer in config
        for (const [productId, watcher] of watchers) {
            if (!products.find(p => p.id === productId)) {
                console.log(`🛑 Stopping watcher for removed product: ${productId}`);
                watcher.close();
                watchers.delete(productId);
            }
        }

        // Start/update watchers for all products
        for (const product of products) {
            startWatching({
                id: product.id,
                name: product.name,
                watchFolder: product.watchFolder || ''
            });
        }
    } catch (error) {
        console.error('Failed to refresh watchers:', error);
    }
}

/**
 * Main entry point
 */
async function main() {
    console.log('='.repeat(60));
    console.log('🚀 iProTraX File Watcher Service');
    console.log('='.repeat(60));
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('');

    // Initial setup
    await refreshWatchers();

    // Periodically check for configuration changes (every 30 seconds)
    setInterval(refreshWatchers, 30000);

    console.log('\n✅ File watcher service is running. Press Ctrl+C to stop.\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down file watcher...');
    for (const watcher of watchers.values()) {
        watcher.close();
    }
    prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down file watcher...');
    for (const watcher of watchers.values()) {
        watcher.close();
    }
    prisma.$disconnect();
    process.exit(0);
});

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
