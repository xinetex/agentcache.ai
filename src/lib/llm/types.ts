export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface CompletionResponse {
    content: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        reasoningTokens?: number;
        totalTokens: number;
    };
    model: string;
    provider: string;
    metadata?: Record<string, any>;
}

export interface LLMProvider {
    chat(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<CompletionResponse>;
}

export interface EmbeddingProvider {
    embed(text: string): Promise<number[]>;
}
