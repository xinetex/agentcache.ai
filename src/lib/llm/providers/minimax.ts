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
import { MiniMaxClient } from '../../minimax.js';
import { AbstractLLMProvider } from '../AbstractLLMProvider.js';
import { LLMRegistry } from '../Registry.js';

export class MiniMaxProvider extends AbstractLLMProvider {
    private client: MiniMaxClient;

    constructor(apiKey?: string, baseUrl?: string) {
        super('minimax', apiKey, baseUrl);
        this.client = new MiniMaxClient(this.apiKey);
    }

    protected async executeChat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        // Map generic messages to MiniMax format
        const mmMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await this.client.chat(
            mmMessages,
            options?.model || 'MiniMax-M2.7',
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
            provider: 'minimax'
        };
    }
}

LLMRegistry.register('minimax', MiniMaxProvider);
