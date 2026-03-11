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
import { LLMRegistry } from './Registry.js';
import { withToolCache } from '../cache/tool.js';

// Import all providers to ensure they are registered in the LLMRegistry
import './providers/openai.js';
import './providers/anthropic.js';
import './providers/gemini.js';
import './providers/moonshot.js';
import './providers/grok.js';
import './providers/perplexity.js';
import './providers/inception.js';
import './providers/ollama.js';

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'moonshot' | 'grok' | 'perplexity' | 'inception' | 'ollama';

export class LLMFactory {
    /**
     * Maps provider types to their default API key environment variables
     */
    private static readonly API_KEY_MAP: Record<string, string | undefined> = {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        gemini: process.env.GEMINI_API_KEY,
        moonshot: process.env.MOONSHOT_API_KEY,
        grok: process.env.AI_GATEWAY_API_KEY,
        perplexity: process.env.PERPLEXITY_API_KEY,
        inception: process.env.INCEPTION_API_KEY,
    };

    /**
     * Polymorphically creates an LLM provider using the Registry pattern
     */
    static createProvider(type: ProviderType, apiKey?: string): LLMProvider {
        const defaultKey = this.API_KEY_MAP[type];

        // Use the Registry to resolve the provider class without switch-case branching
        const provider = LLMRegistry.resolve(type, apiKey || defaultKey);

        // Apply Tool Caching to the 'chat' method (Cross-cutting concern)
        const originalChat = provider.chat.bind(provider);
        provider.chat = withToolCache(
            `llm:${type}`,
            originalChat,
            { ttl: 3600, namespace: 'llm-generation' }
        );

        return provider;
    }
}
