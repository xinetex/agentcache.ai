
/**
 * AgentCache SDK: The Developer Wedge
 * A lightweight wrapper to add semantic caching and coherence telemetry to any LLM app.
 * Now evolved with Phase 5 Resonance: Lateral Knowledge Synthesis.
 */
export class AgentCacheClient {
    private baseUrl: string;
    private apiKey: string;
    private swarmId: string;
    private activeCircles: string[] = [];

    lastCoherenceScore: number = 1.0;
    lastByzantineFlag: boolean = false;
    totalSavingsUsd: number = 0;

    constructor(options: { baseUrl?: string; apiKey: string; swarmId?: string }) {
        this.baseUrl = options.baseUrl || 'https://agentcache.ai';
        this.apiKey = options.apiKey;
        this.swarmId = options.swarmId || 'default-swarm';
    }

    /**
     * Join a Nodal Circle for shared knowledge resonance.
     */
    async joinCircle(circleId: string) {
        try {
            const res = await fetch(`${this.baseUrl}/api/cache/circle/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                body: JSON.stringify({ circleId })
            });
            if (res.ok) {
                this.activeCircles.push(circleId);
                console.log(`[AgentCache] 🕸️ Joined Resonance Circle: ${circleId}`);
            }
        } catch (err) {
            console.error(`[AgentCache] Failed to join circle:`, err);
        }
    }

    /**
     * Leave a Nodal Circle
     */
    async leaveCircle(circleId: string) {
        try {
            await fetch(`${this.baseUrl}/api/cache/circle/leave`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                body: JSON.stringify({ circleId })
            });
            this.activeCircles = this.activeCircles.filter(c => c !== circleId);
            console.log(`[AgentCache] 🕸️ Left Resonance Circle: ${circleId}`);
        } catch (err) {
            console.error(`[AgentCache] Failed to leave circle:`, err);
        }
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

            // 2. Cache Miss - Trigger Resonance Probe (Lateral Knowledge)
            const latestQuery = params.messages[params.messages.length - 1]?.content || '';
            const resonanceRes = await self.probeResonance(latestQuery);
            
            if (resonanceRes && resonanceRes.hits && resonanceRes.hits.length > 0) {
                const bestHit = resonanceRes.hits[0];
                console.log(`[AgentCache] 🧠 Resonance Detected! Injecting echoes from ${bestHit.circleId}`);
                
                // Inject resonance into system prompt or as a new message
                params.messages = [
                    { 
                        role: 'system', 
                        content: `[RESONANT_ECHO from Circle ${bestHit.circleId}]: ${bestHit.text}` 
                    },
                    ...params.messages
                ];
            }

            // 3. Call original provider
            const response = await originalCreate(params, options);

            // 4. Store response in AgentCache (Async/Non-blocking)
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

    private async probeResonance(query: string) {
        try {
            const res = await fetch(`${this.baseUrl}/api/cache/resonance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                body: JSON.stringify({ query, threshold: 0.88 })
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            return null;
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
                    ttl: 604800,
                    circleId: this.activeCircles[0] // Use first active circle for now
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
