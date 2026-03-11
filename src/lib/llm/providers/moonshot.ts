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
import { MoonshotClient } from '../../moonshot.js';
import { AbstractLLMProvider } from '../AbstractLLMProvider.js';
import { LLMRegistry } from '../Registry.js';

export class MoonshotProvider extends AbstractLLMProvider {
    private client: MoonshotClient;

    constructor(apiKey?: string, baseUrl?: string) {
        super('moonshot', apiKey, baseUrl);
        this.client = new MoonshotClient(this.apiKey);
    }

    protected async executeChat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        // Map generic messages to Moonshot format (they are compatible)
        const msMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await this.client.chat(
            msMessages,
            options?.model || 'moonshot-v1-8k',
            options?.temperature
        );

        const choice = response.choices[0];

        return {
            content: choice.message.content,
            usage: {
                inputTokens: response.usage.prompt_tokens,
                outputTokens: response.usage.completion_tokens,
                reasoningTokens: response.usage.reasoning_tokens,
                totalTokens: response.usage.total_tokens
            },
            model: response.model,
            provider: 'moonshot',
            metadata: {
                reasoning_content: choice.message.reasoning_content
            }
        };
    }
}

LLMRegistry.register('moonshot', MoonshotProvider);
