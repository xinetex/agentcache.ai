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
import { GrokClient } from '../../grok.js';
import { AbstractLLMProvider } from '../AbstractLLMProvider.js';
import { LLMRegistry } from '../Registry.js';

export class GrokProvider extends AbstractLLMProvider {
    private client: GrokClient;

    constructor(apiKey?: string, baseUrl?: string) {
        super('grok', apiKey, baseUrl);
        this.client = new GrokClient(this.apiKey);
    }

    protected async executeChat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        // Map generic messages to Grok format
        const grokMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await this.client.chat(
            grokMessages,
            options?.model,
            options?.temperature
        );

        const choice = response.choices[0];

        return {
            content: choice.message.content,
            usage: {
                inputTokens: response.usage.prompt_tokens,
                outputTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
            },
            model: response.model,
            provider: 'grok'
        };
    }
}

LLMRegistry.register('grok', GrokProvider);
