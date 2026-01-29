import { Redis } from '@upstash/redis';

/**
 * Moonshot AI (Kimi K2) Client Library
 * 
 * Handles direct interactions with Moonshot AI API for:
 * - Chat completions
 * - Reasoning token extraction
 * - Context caching
 */

export interface MoonshotMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    reasoning_content?: string; // Support for Kimi's reasoning output
}

export interface MoonshotResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: MoonshotMessage;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        reasoning_tokens?: number; // Kimi K2 specific
    };
}

const MOONSHOT_ENDPOINT = process.env.MOONSHOT_ENDPOINT || 'https://api.moonshot.ai/v1/chat/completions';

export class MoonshotClient {
    private apiKey: string;
    private redis?: Redis;

    constructor(apiKey?: string, redis?: Redis) {
        this.apiKey = apiKey || process.env.MOONSHOT_API_KEY || '';
        this.redis = redis;

        if (!this.apiKey) {
            console.warn('MoonshotClient initialized without API key');
        }
    }

    /**
     * Generate a chat completion
     */
    async chat(
        messages: MoonshotMessage[],
        model: string = 'moonshot-v1-8k',
        temperature?: number
    ): Promise<MoonshotResponse> {
        if (!this.apiKey) {
            throw new Error('Moonshot API key is missing');
        }

        try {
            const response = await fetch(MOONSHOT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Moonshot API Error (${response.status}): ${errorText}`);
            }

            return await response.json() as MoonshotResponse;
        } catch (error) {
            console.error('Moonshot chat failed:', error);
            throw error;
        }
    }

    /**
     * Estimate cost including reasoning tokens
     */
    estimateCost(usage: MoonshotResponse['usage']): number {
        // Pricing (approximate, check official docs)
        // Input: $0.012 / 1k tokens
        // Output: $0.012 / 1k tokens
        // Reasoning: Included in output tokens usually, but tracking separately for analytics

        const inputCost = (usage.prompt_tokens / 1000) * 0.012;
        const outputCost = (usage.completion_tokens / 1000) * 0.012;

        return inputCost + outputCost;
    }
}
