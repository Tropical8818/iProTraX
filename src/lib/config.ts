import fs from 'fs';
import path from 'path';

// In standalone mode, use /app/data or fallback to relative path
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, '.config.json');

// Shift Definition
export interface Shift {
    name: string;
    start: string; // HH:mm
    end: string;   // HH:mm
}

// Product configuration
export interface Product {
    id: string;           // Unique identifier (e.g., "stator")
    name: string;         // Display name (e.g., "Standard Production Line")
    excelPath: string;    // Path to Excel file
    detailColumns: string[]; // Work order detail columns (e.g., WO ID, PN, Description)
    steps: string[];      // Process step column names
    stepDurations?: Record<string, number>; // Estimated duration for each step in hours
    monthlyTarget?: number; // Target quantity for the current month
    customInstructions?: string; // Custom instructions for AI to understand this product line
    aiProvider?: 'openai' | 'ollama' | 'deepseek'; // AI Provider for this specific product
    aiContextLimit?: number; // How many recent orders to fetch for context (default: 60)
    aiMaxTokens?: number; // Max tokens for AI response (default: 4000)

    // Partial Completion & Shift Settings
    stepQuantities?: Record<string, number>; // StepName -> Target Quantity (if tracked by qty)
    stepUnits?: Record<string, string>;      // StepName -> Unit (e.g. "pcs", "m")
    shifts?: Shift[];                        // Product-specific shifts
    overtimeThreshold?: number;              // Minutes after shift end to count as overtime
}

export interface Config {
    products: Product[];
    activeProductId: string;
    includeSaturday?: boolean; // Include Saturday in ECD calculation (default: false)
    includeSunday?: boolean;   // Include Sunday in ECD calculation (default: false)
    aiProvider?: 'openai' | 'ollama' | 'deepseek';
    openAIApiKey?: string; // Stored in config instead of .env for persistence
    openaiModel?: string;  // Default: gpt-4o-mini (user configurable)
    ollamaUrl?: string;
    ollamaModel?: string;
    deepseekApiKey?: string; // DeepSeek API key (for China mainland)
    deepseekModel?: string;  // Default: deepseek-chat
    systemPrompt?: string;
    rolePrompts?: Record<string, string>;
}

// Default steps for new product lines (Generic)
const DEFAULT_STEPS = [
    'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5',
    'Step 6', 'Step 7', 'Step 8', 'Step 9', 'Step 10'
];

const DEFAULT_DETAIL_COLUMNS = ['WO ID', 'PN', 'Description', 'WO DUE', 'Priority'];

const DEFAULT_PRODUCT: Product = {
    id: 'default',
    name: 'Standard Production Line',
    excelPath: '',
    detailColumns: DEFAULT_DETAIL_COLUMNS,
    steps: DEFAULT_STEPS,
    monthlyTarget: 100, // Default target
    aiContextLimit: 60,
    aiMaxTokens: 4000
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
    deepseekModel: 'deepseek-chat' // DeepSeek default model
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
        detailColumns: DEFAULT_DETAIL_COLUMNS,
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
