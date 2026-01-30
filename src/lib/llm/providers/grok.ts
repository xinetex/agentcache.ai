import { LLMProvider, Message, CompletionResponse } from '../types.js';
import { GrokClient } from '../../grok.js';

export class GrokProvider implements LLMProvider {
    private client: GrokClient;

    constructor(apiKey?: string) {
        this.client = new GrokClient(apiKey);
    }

    async chat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
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
