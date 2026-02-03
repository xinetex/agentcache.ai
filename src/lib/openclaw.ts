/**
 * OpenClaw Gateway Client
 * 
 * Connects to the local OpenClaw gateway for LLM inference via Kimi 2.5
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

export class OpenClawClient {
    private baseUrl: string;
    private token: string;
    private model: string;

    constructor(opts?: { host?: string; port?: string; token?: string; model?: string }) {
        const host = opts?.host || process.env.OPENCLAW_HOST || 'http://localhost';
        const port = opts?.port || process.env.OPENCLAW_PORT || '18789';
        this.baseUrl = `${host}:${port}`;
        this.token = opts?.token || process.env.CLAW_API_TOKEN || '';
        this.model = opts?.model || process.env.OPENCLAW_MODEL || 'vercel-ai-gateway/moonshotai/kimi-k2';
    }

    /**
     * Send a chat completion request to OpenClaw gateway
     */
    async chat(messages: OpenClawMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<OpenClawResponse> {
        const endpoint = `${this.baseUrl}/v1/chat/completions`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
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
            throw new Error(`OpenClaw Error (${response.status}): ${error}`);
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
     * Health check
     */
    async ping(): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}/health`);
            return res.ok;
        } catch {
            return false;
        }
    }
}

// Default singleton instance
export const openClaw = new OpenClawClient();
