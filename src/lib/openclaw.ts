/**
 * OpenClaw / Kimi Gateway Client
 * 
 * Production: Uses Moonshot API directly (MOONSHOT_API_KEY)
 * Local Dev: Falls back to local OpenClaw gateway if available
 */

export interface OpenClawMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OpenClawResponse {
    content: string;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

// Moonshot API endpoints
const MOONSHOT_API = 'https://api.moonshot.ai/v1/chat/completions';
const LOCAL_GATEWAY = 'http://localhost:18789/v1/chat/completions';

export class OpenClawClient {
    private apiKey: string;
    private model: string;
    private useProduction: boolean;

    constructor(opts?: { apiKey?: string; model?: string }) {
        this.apiKey = opts?.apiKey || process.env.MOONSHOT_API_KEY || process.env.CLAW_API_TOKEN || '';
        this.model = opts?.model || process.env.KIMI_MODEL || 'kimi-k2-0711-preview';

        // Use production Moonshot API if we have MOONSHOT_API_KEY
        this.useProduction = !!process.env.MOONSHOT_API_KEY;

        console.log(`[OpenClawClient] Mode: ${this.useProduction ? 'PRODUCTION (Moonshot API)' : 'LOCAL (Gateway)'}`);
    }

    /**
     * Send a chat completion request
     */
    async chat(messages: OpenClawMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<OpenClawResponse> {
        const endpoint = this.useProduction ? MOONSHOT_API : LOCAL_GATEWAY;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: opts?.temperature ?? 0.7,
                max_tokens: opts?.maxTokens ?? 2048
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Kimi API Error (${response.status}): ${error}`);
        }

        const data = await response.json();

        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || this.model,
            usage: data.usage
        };
    }

    /**
     * Simple completion helper
     */
    async complete(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: OpenClawMessage[] = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await this.chat(messages);
        return response.content;
    }

    /**
     * Health check - in production, just return true (API is always available)
     */
    async ping(): Promise<boolean> {
        if (this.useProduction) {
            return !!this.apiKey;
        }
        try {
            const res = await fetch('http://localhost:18789/health');
            return res.ok;
        } catch {
            return false;
        }
    }
}

// Default singleton instance
export const openClaw = new OpenClawClient();
