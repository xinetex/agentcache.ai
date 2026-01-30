import { LLMProvider } from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';
import { MoonshotProvider } from './providers/moonshot.js';
import { GrokProvider } from './providers/grok.js';
import { PerplexityProvider } from './providers/perplexity.js';
import { withToolCache } from '../cache/tool.js';

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'moonshot' | 'grok' | 'perplexity';

export class LLMFactory {
    static createProvider(type: ProviderType, apiKey?: string): LLMProvider {
        let provider: LLMProvider;
        switch (type) {
            case 'openai':
                provider = new OpenAIProvider(apiKey || process.env.OPENAI_API_KEY);
                break;
            case 'anthropic':
                provider = new AnthropicProvider(apiKey || process.env.ANTHROPIC_API_KEY);
                break;
            case 'gemini':
                provider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY);
                break;
            case 'moonshot':
                provider = new MoonshotProvider(apiKey || process.env.MOONSHOT_API_KEY);
                break;
            case 'grok':
                provider = new GrokProvider(apiKey || process.env.AI_GATEWAY_API_KEY);
                break;
            case 'perplexity':
                provider = new PerplexityProvider(apiKey || process.env.PERPLEXITY_API_KEY);
                break;
            default:
                throw new Error(`Unknown provider type: ${type}`);
        }

        // Apply Tool Caching to the 'chat' method
        const originalChat = provider.chat.bind(provider);
        provider.chat = withToolCache(
            `llm:${type}`,
            originalChat,
            { ttl: 3600, namespace: 'llm-generation' }
        );

        return provider;
    }
}
