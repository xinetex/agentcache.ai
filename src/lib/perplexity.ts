
/**
 * Perplexity (Sonar) Client Library
 * 
 * Handles interactions with Perplexity AI Search models.
 * Serves as the "System 3" (Truth Layer) in the cognitive architecture.
 */

export interface PerplexityMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface PerplexityResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: PerplexityMessage;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    citations?: string[]; // Perplexity specific
}

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

export class PerplexityClient {
    private apiKey: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.PERPLEXITY_API_KEY || '';

        if (!this.apiKey) {
            console.warn('PerplexityClient initialized without API key');
        }
    }

    /**
     * Generate a chat completion with search grounding
     */
    async chat(
        messages: PerplexityMessage[],
        model: string = process.env.PERPLEXITY_MODEL || 'sonar-pro',
        options: {
            temperature?: number;
            max_tokens?: number;
            return_citations?: boolean;
            search_domain_filter?: string[];
        } = {}
    ): Promise<PerplexityResponse> {
        if (!this.apiKey) {
            throw new Error('Perplexity API key is missing');
        }

        try {
            const body: any = {
                model,
                messages,
                temperature: options.temperature || 0.2, // Lower temp for facts
                stream: false,
                return_citations: options.return_citations !== false, // Default to true
            };

            if (options.max_tokens) {
                body.max_tokens = options.max_tokens;
            }

            if (options.search_domain_filter && options.search_domain_filter.length > 0) {
                body.search_domain_filter = options.search_domain_filter;
            }

            const response = await fetch(PERPLEXITY_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Perplexity API Error (${response.status}): ${errorText}`);
            }

            return await response.json() as PerplexityResponse;
        } catch (error) {
            console.error('Perplexity chat failed:', error);
            throw error;
        }
    }
}
