import { Redis } from '@upstash/redis';

/**
 * Grok / AI Gateway Client Library
 * 
 * Handles interactions with xAI's Grok via AI Gateway.
 */

export interface GrokMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface GrokResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: GrokMessage;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'https://api.x.ai/v1/chat/completions';

export class GrokClient {
    private apiKey: string;
    private redis?: Redis;

    constructor(apiKey?: string, redis?: Redis) {
        this.apiKey = apiKey || process.env.AI_GATEWAY_API_KEY || '';
        this.redis = redis;

        if (!this.apiKey) {
            console.warn('GrokClient initialized without API key');
        }
    }

    /**
     * Generate a chat completion
     */
    async chat(
        messages: GrokMessage[],
        model: string = process.env.AI_GATEWAY_MODEL || 'grok-beta',
        temperature: number = 0.7
    ): Promise<GrokResponse> {
        if (!this.apiKey) {
            throw new Error('AI Gateway API key is missing');
        }

        try {
            const response = await fetch(AI_GATEWAY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature, // xAI API supports temperature
                    stream: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI Gateway Error (${response.status}): ${errorText}`);
            }

            return await response.json() as GrokResponse;
        } catch (error) {
            console.error('Grok chat failed:', error);
            throw error;
        }
    }
}
