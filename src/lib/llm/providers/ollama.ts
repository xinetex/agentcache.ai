/**
 * Ollama LLM Provider
 * 
 * Local LLM integration for zero-cost operational tasks.
 * Handles: heartbeats, file organization, CSV cleanup, simple queries.
 * 
 * Prerequisites:
 * - Ollama installed: https://ollama.ai
 * - Model pulled: `ollama pull llama3:latest`
 * - Server running: `ollama serve` (default port 11434)
 */

import { LLMProvider, Message, CompletionResponse } from '../types.js';

export class OllamaProvider implements LLMProvider {
    private baseUrl: string;
    private defaultModel: string;

    constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3:latest') {
        this.baseUrl = baseUrl;
        this.defaultModel = model;
    }

    async chat(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<CompletionResponse> {
        const model = options?.model || this.defaultModel;
        const startTime = Date.now();

        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    stream: false,
                    options: {
                        temperature: options?.temperature ?? 0.7,
                        num_predict: options?.maxTokens ?? 1024
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Ollama API error: ${error}`);
            }

            const data = await response.json();
            const latency = Date.now() - startTime;

            // Ollama provides token counts in the response
            const inputTokens = data.prompt_eval_count || 0;
            const outputTokens = data.eval_count || 0;

            return {
                content: data.message?.content || '',
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens
                },
                model,
                provider: 'ollama',
                metadata: {
                    latencyMs: latency,
                    costUsd: 0, // Local = FREE
                    tier: 'local'
                }
            };
        } catch (err: any) {
            // If Ollama is not running, return a graceful fallback
            if (err.cause?.code === 'ECONNREFUSED') {
                console.warn('[Ollama] Server not running. Returning fallback response.');
                return {
                    content: 'OK',
                    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                    model: 'fallback',
                    provider: 'ollama',
                    metadata: { error: 'Connection refused', costUsd: 0 }
                };
            }
            throw err;
        }
    }

    /**
     * Check if Ollama server is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * List available models on the local Ollama instance
     */
    async listModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.models?.map((m: any) => m.name) || [];
        } catch {
            return [];
        }
    }
}

export const ollama = new OllamaProvider();
