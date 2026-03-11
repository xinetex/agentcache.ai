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

export class AnthropicProvider extends AbstractLLMProvider {
    constructor(apiKey?: string, baseUrl: string = 'https://api.anthropic.com/v1') {
        super('anthropic', apiKey, baseUrl);
    }

    protected async executeChat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        const model = options?.model || 'claude-3-5-sonnet-20240620';

        // Convert 'system' role to top-level system parameter for Anthropic
        const systemMessage = messages.find(m => m.role === 'system');
        const anthropicMessages = messages.filter(m => m.role !== 'system');

        const res = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model,
                system: systemMessage?.content,
                messages: anthropicMessages,
                temperature: options?.temperature || 0.7,
                max_tokens: options?.maxTokens || 4096,
            })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Anthropic API Error: ${error}`);
        }

        const data = await res.json();

        return {
            content: data.content[0].text,
            usage: {
                inputTokens: data.usage.input_tokens,
                outputTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens
            },
            model: data.model,
            provider: 'anthropic'
        };
    }
}

LLMRegistry.register('anthropic', AnthropicProvider);
