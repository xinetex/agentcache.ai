
/**
 * AgentCache SDK: The Developer Wedge
 * A lightweight wrapper to add semantic caching and coherence telemetry to any LLM app.
 */
export class AgentCacheClient {
    private baseUrl: string;
    private apiKey: string;
    private swarmId: string;

    lastCoherenceScore: number = 1.0;
    lastByzantineFlag: boolean = false;
    totalSavingsUsd: number = 0;

    constructor(options: { baseUrl?: string; apiKey: string; swarmId?: string }) {
        this.baseUrl = options.baseUrl || 'https://agentcache.ai';
        this.apiKey = options.apiKey;
        this.swarmId = options.swarmId || 'default-swarm';
    }

    /**
     * Wrap an OpenAI-compatible client to intercept completions.
     */
    wrapOpenAI(openai: any) {
        const originalCreate = openai.chat.completions.create.bind(openai.chat.completions);
        const self = this;

        openai.chat.completions.create = async function (params: any, options?: any) {
            // 1. Check AgentCache for a hit
            const cacheCheck = await self.checkCache(params);

            if (cacheCheck.cached && cacheCheck.response) {
                console.log(`[AgentCache] 🎯 Cache Hit! Saved ~$${cacheCheck.savedUsd || '0.01'}`);
                self.updateTelemetry(cacheCheck);
                return {
                    id: `cache-${cacheCheck.key}`,
                    choices: [{ message: { content: cacheCheck.response, role: 'assistant' } }],
                    usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 },
                    model: params.model,
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    from_cache: true
                };
            }

            // 2. Cache Miss - Call original provider
            const response = await originalCreate(params, options);

            // 3. Store response in AgentCache (Async/Non-blocking)
            self.setCache(params, response.choices[0].message.content).catch(() => {});

            return response;
        };

        return openai;
    }

    private async checkCache(params: any) {
        try {
            const res = await fetch(`${this.baseUrl}/api/cache/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                    'X-Swarm-Id': this.swarmId
                },
                body: JSON.stringify({
                    provider: 'openai',
                    model: params.model,
                    messages: params.messages,
                    temperature: params.temperature || 0.7,
                    semantic: true
                })
            });

            if (!res.ok) return { cached: false };
            
            const data = await res.json();
            // If cached, we need to actually GET the content
            if (data.cached) {
                const getRes = await fetch(`${this.baseUrl}/api/cache/get`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': this.apiKey
                    },
                    body: JSON.stringify({
                        provider: 'openai',
                        model: params.model,
                        messages: params.messages
                    })
                });
                return await getRes.json();
            }
            return data;
        } catch (err) {
            return { cached: false };
        }
    }

    private async setCache(params: any, content: string) {
        try {
            await fetch(`${this.baseUrl}/api/cache/set`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                body: JSON.stringify({
                    provider: 'openai',
                    model: params.model,
                    messages: params.messages,
                    response: content,
                    ttl: 604800 // 7 days default
                })
            });
        } catch (err) {
            console.warn('[AgentCache] Failed to store response:', err);
        }
    }

    private updateTelemetry(data: any) {
        if (data.coherence !== undefined) this.lastCoherenceScore = data.coherence;
        if (data.byzantine !== undefined) this.lastByzantineFlag = data.byzantine;
        if (data.savedUsd !== undefined) this.totalSavingsUsd += data.savedUsd;
    }
}
