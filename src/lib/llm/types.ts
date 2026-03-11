/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface CompletionResponse {
    content: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        reasoningTokens?: number;
        totalTokens: number;
    };
    model: string;
    provider: string;
    metadata?: Record<string, any>;
}

export interface LLMProvider {
    chat(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<CompletionResponse>;
}

export interface EmbeddingProvider {
    embed(text: string): Promise<number[]>;
}
