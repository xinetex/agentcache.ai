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

export class OpenAIProvider extends AbstractLLMProvider {
    constructor(apiKey?: string, baseUrl: string = 'https://api.openai.com/v1') {
        super('openai', apiKey, baseUrl);
    }

    protected async executeChat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        const model = options?.model || 'gpt-4o';

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: options?.temperature || 0.7,
                max_tokens: options?.maxTokens,
            })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`OpenAI API Error: ${error}`);
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
            provider: 'openai'
        };
    }
}

LLMRegistry.register('openai', OpenAIProvider);
