/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { Message, CompletionResponse } from '../types.js';
import { AbstractLLMProvider } from '../AbstractLLMProvider.js';
import { LLMRegistry } from '../Registry.js';

export class InceptionLabsProvider extends AbstractLLMProvider {
    constructor(apiKey?: string, baseUrl: string = 'https://api.inceptionlabs.ai/v1') {
        super('inception', apiKey, baseUrl);
    }

    protected async executeChat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        // Note: Using an aggressive default model optimized for instant response/structured outputs if one isn't provided
        const model = options?.model || 'mercury';

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: options?.temperature !== undefined ? options.temperature : 0.1, // Lower default temp for structure
                max_tokens: options?.maxTokens,
            })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Inception Labs API Error: ${error}`);
        }

        const data = await res.json();
        const choice = data.choices[0];

        return {
            content: choice.message.content,
            usage: {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            },
            model: data.model,
            provider: 'inception'
        };
    }
}

LLMRegistry.register('inception', InceptionLabsProvider);
