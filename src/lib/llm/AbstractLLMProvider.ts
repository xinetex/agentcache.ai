/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { LLMProvider, Message, CompletionResponse } from './types.js';

export abstract class AbstractLLMProvider implements LLMProvider {
    protected apiKey: string;
    protected baseUrl: string;
    protected providerName: string;

    constructor(providerName: string, apiKey?: string, baseUrl?: string) {
        this.providerName = providerName;
        this.apiKey = apiKey || '';
        this.baseUrl = baseUrl || '';
    }

    /**
     * Standardized chat method with retry logic and unified error handling
     */
    async chat(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        retries?: number;
    }): Promise<CompletionResponse> {
        this.validateConfig();

        const maxRetries = options?.retries ?? 3;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    console.log(`[${this.providerName}] Retry attempt ${attempt}/${maxRetries}...`);
                }

                return await this.executeChat(messages, options);
            } catch (err: any) {
                lastError = err;

                // Don't retry on certain errors (auth, validation, etc.)
                if (this.isNonRetriableError(err)) {
                    break;
                }
            }
        }

        throw new Error(`[${this.providerName}] Failed after ${maxRetries} retries. Original Error: ${lastError?.message}`);
    }

    /**
     * Subclasses implement the specific API handshake
     */
    protected abstract executeChat(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number
    }): Promise<CompletionResponse>;

    /**
     * Basic validation for providers
     */
    protected validateConfig(): void {
        if (!this.apiKey && this.requiresApiKey()) {
            throw new Error(`[${this.providerName}] API key is missing`);
        }
    }

    /**
     * Override if the provider doesn't need an API key (e.g. local)
     */
    protected requiresApiKey(): boolean {
        return true;
    }

    /**
     * Logic to determine if an error should trigger a retry
     */
    protected isNonRetriableError(err: any): boolean {
        const msg = err.message.toLowerCase();
        return msg.includes('auth') ||
            msg.includes('api key') ||
            msg.includes('invalid') ||
            msg.includes('401') ||
            msg.includes('403') ||
            msg.includes('400') ||
            msg.includes('422');
    }
}
