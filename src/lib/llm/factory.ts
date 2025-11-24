import { LLMProvider } from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';
import { MoonshotProvider } from './providers/moonshot.js';

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'moonshot';

export class LLMFactory {
    static createProvider(type: ProviderType, apiKey?: string): LLMProvider {
        switch (type) {
            case 'openai':
                return new OpenAIProvider(apiKey || process.env.OPENAI_API_KEY);
            case 'anthropic':
                return new AnthropicProvider(apiKey || process.env.ANTHROPIC_API_KEY);
            case 'gemini':
                return new GeminiProvider(apiKey || process.env.GEMINI_API_KEY);
            case 'moonshot':
                return new MoonshotProvider(apiKey || process.env.MOONSHOT_API_KEY);
            default:
                throw new Error(`Unknown provider type: ${type}`);
        }
    }
}
