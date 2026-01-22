import OpenAI from 'openai';
import { getConfig } from '../config';

// Get OpenAI client based on configuration (OpenAI, Ollama, or DeepSeek)
function getOpenAI(providerOverride?: 'openai' | 'ollama' | 'deepseek'): OpenAI {
    const config = getConfig();
    const provider = providerOverride || config.aiProvider || 'openai';

    if (provider === 'ollama') {
        // Ollama local instance
        const baseURL = config.ollamaUrl || 'http://localhost:11434/v1';
        return new OpenAI({
            baseURL,
            apiKey: 'ollama', // Required by SDK but unused by Ollama
            dangerouslyAllowBrowser: true // Sometimes needed for local dev
        });
    }

    // DeepSeek (China mainland friendly)
    if (provider === 'deepseek') {
        const apiKey = config.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error('DeepSeek API key not configured. Set it in Settings or DEEPSEEK_API_KEY env var.');
        }
        return new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey
        });
    }

    // Default: OpenAI Cloud
    const apiKey = config.openAIApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('your-')) {
        throw new Error('OpenAI API key not configured');
    }
    return new OpenAI({ apiKey });
}

// Helper for chat completions
export async function chat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        provider?: 'openai' | 'ollama' | 'deepseek';
    }
) {
    const config = getConfig();
    const openai = getOpenAI(options?.provider);

    // Determine model to use based on provider
    let model = options?.model;

    // Get effective provider
    const effectiveProvider = options?.provider || config.aiProvider || 'openai';

    // Use configured model for each provider if not explicitly specified
    if (!model) {
        switch (effectiveProvider) {
            case 'ollama':
                model = config.ollamaModel || 'llama3.1';
                break;
            case 'deepseek':
                model = config.deepseekModel || 'deepseek-chat';
                break;
            case 'openai':
            default:
                model = config.openaiModel || 'gpt-4o-mini';
                break;
        }
    }

    // OPTIMIZATION: Different token limits for different providers
    // Ollama local models need more tokens for comprehensive responses
    const maxTokens = options?.maxTokens || (
        (options?.provider === 'ollama' || config.aiProvider === 'ollama') ? 4000 : 1000
    );

    // Debug logging for Ollama
    if (options?.provider === 'ollama' || config.aiProvider === 'ollama') {
        console.log('[Ollama] Using model:', model);
        console.log('[Ollama] Context size:', JSON.stringify(messages).length, 'chars');
        console.log('[Ollama] Max tokens:', maxTokens);
    }

    // Add timeout to prevent hanging requests (especially for Ollama)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
        const response = await openai.chat.completions.create({
            model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: maxTokens,
        });

        clearTimeout(timeout);
        return response.choices[0]?.message?.content || '';
    } catch (error: any) {
        clearTimeout(timeout);

        // Better error messages for common Ollama issues
        if (error.name === 'AbortError') {
            throw new Error('AI request timed out after 60 seconds. Local model may be slow or unresponsive. Try a smaller model or reduce context size.');
        }
        if (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED')) {
            throw new Error('Cannot connect to Ollama. Please ensure Ollama is running on http://localhost:11434');
        }
        if (error.message?.includes('model') && error.message?.includes('not found')) {
            throw new Error(`Model "${model}" not found. Please pull it with: ollama pull ${model}`);
        }

        console.error('[AI Client] Error:', error);
        throw error;
    }
}

// Stream chat for real-time responses
export async function* streamChat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options?: {
        model?: string;
        temperature?: number;
    }
) {
    const config = getConfig();
    const openai = getOpenAI();

    // Determine model to use based on provider
    let model = options?.model;
    if (!model) {
        switch (config.aiProvider) {
            case 'ollama':
                model = config.ollamaModel || 'llama3.1';
                break;
            case 'deepseek':
                model = config.deepseekModel || 'deepseek-chat';
                break;
            case 'openai':
            default:
                model = config.openaiModel || 'gpt-4o-mini';
                break;
        }
    }

    // Unified configuration for both Cloud and Local AI
    // User requested identical configuration for both
    const maxTokens = 4000;

    // Debug logging
    console.log(`[AI Stream] Provider: ${config.aiProvider}, Model: ${model}, MaxTokens: ${maxTokens}`);

    // Add timeout controller (60s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const stream = await openai.chat.completions.create({
            model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: maxTokens,
            stream: true,
        }, { signal: controller.signal });

        clearTimeout(timeoutId);

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[AI Stream] Error:', error);

        if (error.name === 'AbortError') {
            yield 'Error: AI request timed out (60s). Please try again or check your model configuration.';
        } else if (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED')) {
            yield 'Error: Cannot connect to AI service. If using Ollama, ensure it is running.';
        } else {
            yield `Error: ${error.message || 'Stream failed'}`;
        }
    }
}

export default getOpenAI;
