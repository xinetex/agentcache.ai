/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { LLMProvider } from './types.js';

export type LLMProviderConstructor = new (apiKey?: string, baseUrl?: string) => LLMProvider;

export class LLMRegistry {
    private static providers: Map<string, LLMProviderConstructor> = new Map();

    /**
     * Register a provider class
     */
    static register(name: string, providerClass: LLMProviderConstructor) {
        this.providers.set(name, providerClass);
    }

    /**
     * Resolve a provider instance from the registry
     */
    static resolve(name: string, apiKey?: string, baseUrl?: string): LLMProvider {
        const ProviderClass = this.providers.get(name);
        if (!ProviderClass) {
            throw new Error(`LLM Provider '${name}' not found in registry`);
        }
        return new ProviderClass(apiKey, baseUrl);
    }

    /**
     * Get list of supported providers
     */
    static list(): string[] {
        return Array.from(this.providers.keys());
    }
}
