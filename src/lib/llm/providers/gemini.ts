import { LLMProvider, Message, CompletionResponse } from '../types.js';

export class GeminiProvider implements LLMProvider {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || '';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async chat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<CompletionResponse> {
        if (!this.apiKey) throw new Error('Gemini API key missing');

        const model = options?.model || 'gemini-1.5-flash';

        // Convert messages to Gemini format
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // Handle system instruction if present (Gemini 1.5 supports system instructions)
        // For simplicity in this v1, we might just prepend to first user message or use system_instruction API field
        const systemMessage = messages.find(m => m.role === 'system');
        const chatContents = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        const body: any = {
            contents: chatContents,
            generationConfig: {
                temperature: options?.temperature || 0.7,
                maxOutputTokens: options?.maxTokens,
            }
        };

        if (systemMessage) {
            body.systemInstruction = {
                parts: [{ text: systemMessage.content }]
            };
        }

        const res = await fetch(`${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Gemini API Error: ${error}`);
        }

        const data = await res.json();
        const candidate = data.candidates[0];

        return {
            content: candidate.content.parts[0].text,
            usage: {
                inputTokens: data.usageMetadata?.promptTokenCount || 0,
                outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata?.totalTokenCount || 0
            },
            model: model,
            provider: 'gemini'
        };
    }
}
