import { LLMProvider, Message, CompletionResponse } from '../types.js';

export class AnthropicProvider implements LLMProvider {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey?: string, baseUrl: string = 'https://api.anthropic.com/v1') {
        this.apiKey = apiKey || '';
        this.baseUrl = baseUrl;
    }

    async chat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        if (!this.apiKey) throw new Error('Anthropic API key missing');

        const model = options?.model || 'claude-3-5-sonnet-20240620';

        // Convert 'system' role to top-level system parameter for Anthropic
        const systemMessage = messages.find(m => m.role === 'system');
        const anthropicMessages = messages.filter(m => m.role !== 'system');

        const res = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model,
                system: systemMessage?.content,
                messages: anthropicMessages,
                temperature: options?.temperature || 0.7,
                max_tokens: options?.maxTokens || 4096,
            })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Anthropic API Error: ${error}`);
        }

        const data = await res.json();

        return {
            content: data.content[0].text,
            usage: {
                inputTokens: data.usage.input_tokens,
                outputTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens
            },
            model: data.model,
            provider: 'anthropic'
        };
    }
}
