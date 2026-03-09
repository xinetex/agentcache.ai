import { LLMProvider, Message, CompletionResponse } from '../types.js';

export class InceptionLabsProvider implements LLMProvider {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey?: string, baseUrl: string = 'https://api.inceptionlabs.ai/v1') {
        this.apiKey = apiKey || '';
        this.baseUrl = baseUrl;
    }

    async chat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        if (!this.apiKey) throw new Error('Inception Labs API key missing');

        // Note: Using an aggressive default model optimized for instant response/structured outputs if one isn't provided
        const model = options?.model || 'inception-base';

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: options?.temperature !== undefined ? options.temperature : 0.1, // Lower default temp for structure
                max_tokens: options?.maxTokens,
            })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Inception Labs API Error: ${error}`);
        }

        const data = await res.json();
        const choice = data.choices[0];

        return {
            content: choice.message.content,
            usage: {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            },
            model: data.model,
            provider: 'inception'
        };
    }
}
