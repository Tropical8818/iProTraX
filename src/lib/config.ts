import fs from 'fs';
import path from 'path';
import { Config, Product, Shift, WebhookConfig } from './types/config';

// Re-export types for backward compatibility
export type { Config, Product, Shift, WebhookConfig };

// In standalone mode, use /app/data or fallback to relative path
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, '.config.json');

// Default steps for new product lines (Generic)
const DEFAULT_STEPS = [
    'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5',
    'Step 6', 'Step 7', 'Step 8', 'Step 9', 'Step 10'
];

// Note: DEFAULT_DETAIL_COLUMNS removed to support fully flexible column names

const DEFAULT_PRODUCT: Product = {
    id: 'default',
    name: 'Standard Production Line',
    excelPath: '',
    detailColumns: [], // Start empty, populated by Import
    steps: DEFAULT_STEPS,
    monthlyTarget: 100, // Default target
    aiContextLimit: 60,
    aiMaxTokens: 4000,
    schedulingConfig: {
        dateWeight: 50,
        agingWeight: 50
    },
    shiftConfig: {
        standardHours: 8,
        overtimeHours: 0
    }
};

const DEFAULT_CONFIG: Config = {
    products: [DEFAULT_PRODUCT],
    activeProductId: 'default',
    includeSaturday: false, // Default: exclude Saturday
    includeSunday: false,   // Default: exclude Sunday
    aiProvider: 'openai',   // Default to OpenAI
    openaiModel: 'gpt-4o-mini', // Default OpenAI model (user can change)
    ollamaUrl: 'http://localhost:11434/v1',
    ollamaModel: 'llama3.1',
    deepseekModel: 'deepseek-chat', // DeepSeek default model
    webhooks: []
};

// Migrate from old config format (v2) to new format (v3)
function migrateConfig(parsed: Record<string, unknown>): Config {
    // Check if already in new format
    if (Array.isArray(parsed.products)) {
        return {
            ...DEFAULT_CONFIG,
            ...parsed,
            products: parsed.products as Product[]
        };
    }

    // Migrate from old format
    console.log('[Config] Migrating from v2 to v3 format...');

    const migratedProduct: Product = {
        id: 'default',
        name: 'Standard Production Line',
        excelPath: (parsed.EXCEL_FILE_PATH as string) || '',
        detailColumns: [], // DEFAULT_DETAIL_COLUMNS removed
        steps: DEFAULT_STEPS,
        monthlyTarget: 100,
        aiContextLimit: 60,
        aiMaxTokens: 4000
    };

    return {
        products: [migratedProduct],
        activeProductId: 'default',
    };
}

export function getConfig(): Config {
    try {
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            console.log('[Config] Creating data directory:', DATA_DIR);
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        // If config doesn't exist, create with defaults
        if (!fs.existsSync(CONFIG_PATH)) {
            console.log('[Config] Creating default config at:', CONFIG_PATH);
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 4));
            return DEFAULT_CONFIG;
        }

        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        const config = migrateConfig(parsed);

        // Save migrated config if format changed
        if (!Array.isArray(parsed.products)) {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
            console.log('[Config] Migration completed and saved.');
        }

        return config;
    } catch (err) {
        console.error('[Config] Read error:', err);
        return DEFAULT_CONFIG;
    }
}

export function updateConfig(newConfig: Partial<Config>): Config {
    try {
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        const current = getConfig();
        const updated = { ...current, ...newConfig };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 4));
        return updated;
    } catch (err) {
        console.error('Config write error:', err);
        throw new Error('Failed to save config');
    }
}

// Helper to get active product
export function getActiveProduct(): Product | null {
    const config = getConfig();
    return config.products.find(p => p.id === config.activeProductId) || config.products[0] || null;
}

// Helper to get product by ID
export function getProductById(productId: string): Product | null {
    const config = getConfig();
    return config.products.find(p => p.id === productId) || null;
}
