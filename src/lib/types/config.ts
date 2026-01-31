// Shift Definition
export interface Shift {
    name: string;
    start: string; // HH:mm
    end: string;   // HH:mm
}

export interface WebhookConfig {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    provider: 'slack' | 'teams' | 'dingtalk' | 'wecom' | 'feishu' | 'telegram' | 'discord' | 'bark' | 'gotify' | 'serverchan' | 'pushdeer' | 'matrix' | 'custom';
    events: ('on_hold' | 'on_qn' | 'on_done' | 'on_step_update' | 'on_morning_report' | 'on_message')[];
    // For custom provider:
    customPayload?: string; // JSON string with placeholders like {{orderId}}, {{step}}
    customHeaders?: Record<string, string>;
    settings?: Record<string, string>; // Provider-specific settings (e.g. deviceKey, sound, chat_id)
}

export interface SchedulingConfig {
    priorityWeight?: number; // Deprecated: Priority now uses fixed bonus (Red +1000, Yellow x2)
    dateWeight: number;
    agingWeight: number;
    flowWeight?: number; // Optional weight for continuity (default 500)
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
    includeSaturday?: boolean; // Override global setting
    includeSunday?: boolean;   // Override global setting
    customInstructions?: string; // Custom instructions for AI to understand this product line
    aiProvider?: 'openai' | 'ollama' | 'deepseek'; // AI Provider for this specific product
    aiContextLimit?: number; // How many recent orders to fetch for context (default: 60)
    aiMaxTokens?: number; // Max tokens for AI response (default: 4000)

    // Partial Completion & Shift Settings
    stepQuantities?: Record<string, number>; // StepName -> Target Quantity (if tracked by qty)
    stepUnits?: Record<string, string>;      // StepName -> Unit (e.g. "pcs", "m")
    shifts?: Shift[];                        // Product-specific shifts
    overtimeThreshold?: number;              // Minutes after shift end to count as overtime

    // AI Visibility (Added from Settings Page local type)
    watchFolder?: string;
    aiModel?: string;
    aiVisibleColumns?: string[];
    aiVisibleSteps?: string[];

    // 4M1E & Scheduling
    stepStaffCounts?: Record<string, number>;   // Man (人员)
    stepMachineCounts?: Record<string, number>; // Machine (机器)
    schedulingConfig?: SchedulingConfig;        // Weights for AI scoring
    shiftConfig?: {                             // Environment (环境/班次)
        standardHours: number;
        overtimeHours: number;
    };
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
    webhooks?: WebhookConfig[];

    // Enterprise / License fields (Added from Settings Page local type)
    kioskPin?: string;
    license?: {
        maxProductLines: number;
        totalProducts: number;
        isLimited: boolean;
        warning?: string;
    };
}
