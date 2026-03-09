import { Message, CompletionResponse } from '../types.js';
import { PerplexityClient } from '../../perplexity.js';
import { AbstractLLMProvider } from '../AbstractLLMProvider.js';
import { LLMRegistry } from '../Registry.js';

export class PerplexityProvider extends AbstractLLMProvider {
    private client: PerplexityClient;

    constructor(apiKey?: string, baseUrl?: string) {
        super('perplexity', apiKey, baseUrl);
        this.client = new PerplexityClient(this.apiKey);
    }

    protected async executeChat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        // Map generic messages to Perplexity format
        const perplexityMessages = messages.map(m => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content
        }));

        const response = await this.client.chat(
            perplexityMessages,
            options?.model,
            {
                temperature: options?.temperature,
                max_tokens: options?.maxTokens,
                return_citations: true
            }
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
            provider: 'perplexity',
            metadata: {
                citations: response.citations || []
            }
        };
    }
}

LLMRegistry.register('perplexity', PerplexityProvider);
