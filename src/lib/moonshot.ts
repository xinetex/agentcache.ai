/**
 * Moonshot AI Client Wrapper
 * Handles calls to the /api/moonshot endpoint with reasoning token caching
 */

export interface MoonshotMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface MoonshotResponse {
    content: string;
    reasoning_tokens?: number;
    cache_hit: boolean;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        reasoning_tokens?: number;
    };
}

export interface MoonshotOptions {
    model?: string;
    temperature?: number;
    cache_reasoning?: boolean;
}

const MOONSHOT_ENDPOINT = process.env.MOONSHOT_ENDPOINT || 'http://localhost:3001/api/moonshot';
const API_KEY = process.env.AGENTCACHE_API_KEY || 'ac_demo_test123';

/**
 * Call Moonshot API with context and user message
 */
export async function callMoonshot(
    messages: MoonshotMessage[],
    options: MoonshotOptions = {}
): Promise<MoonshotResponse> {
    const {
        model = 'moonshot-v1-128k',
        temperature = 0.7,
        cache_reasoning = true
    } = options;

    const response = await fetch(MOONSHOT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
        },
        body: JSON.stringify({
            messages,
            model,
            temperature,
            cache_reasoning
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Moonshot API error: ${error}`);
    }

    const data: any = await response.json();

    return {
        content: data.choices?.[0]?.message?.content || data.content || '',
        reasoning_tokens: data.usage?.reasoning_tokens,
        cache_hit: data.cache_hit || false,
        model: data.model || model,
        usage: data.usage
    };
}
