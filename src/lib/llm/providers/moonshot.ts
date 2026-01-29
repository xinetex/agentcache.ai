import { LLMProvider, Message, CompletionResponse } from '../types.js';
import { MoonshotClient } from '../../moonshot.js';

export class MoonshotProvider implements LLMProvider {
    private client: MoonshotClient;

    constructor(apiKey?: string) {
        this.client = new MoonshotClient(apiKey);
    }

    async chat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
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
