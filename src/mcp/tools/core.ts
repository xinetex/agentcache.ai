
import { z } from 'zod';
import { ToolModule, ToolHandlerContext } from '../registry.js';
import { SecurityMiddleware, hashAPIKey } from '../security.js';

// Schemas
const CacheGetSchema = z.object({
    provider: z.enum(['openai', 'anthropic', 'google']).describe('LLM provider name'),
    model: z.string().describe('Model identifier (e.g., gpt-4, claude-3-opus)'),
    messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
    })).describe('Conversation messages'),
    temperature: z.number().optional().default(0.7),
    namespace: z.string().optional().describe('Optional cache namespace for multi-tenancy'),
});

const CacheSetSchema = z.object({
    provider: z.string(),
    model: z.string(),
    messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
    })),
    temperature: z.number().optional().default(0.7),
    response: z.any().describe('LLM response to cache'),
    namespace: z.string().optional(),
    ttl: z.number().optional().describe('Cache TTL in seconds (default: 604800 = 7 days)'),
});

const CacheCheckSchema = z.object({
    provider: z.string(),
    model: z.string(),
    messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
    })),
    temperature: z.number().optional().default(0.7),
    namespace: z.string().optional(),
});

const CacheStatsSchema = z.object({
    period: z.enum(['24h', '7d', '30d']).optional().default('24h'),
    namespace: z.string().optional(),
});

// Helper function to call AgentCache API (Replicated here or imported from a shared util if we create one)
// For now, let's assume we can import it or pass it in. To avoid circular deps, we might need a lib/api.ts
// But to keep it simple during migration, I'll use the environment variable and fetch pattern directly or passed via context?
// Actually, `server.ts` had `callAgentCacheAPI`. Let's create a shared utility for this.
// WAIT: The context doesn't include the API calling capability.
// I should probably extract `callAgentCacheAPI` to a separate file first.

const AGENTCACHE_API_URL = process.env.AGENTCACHE_API_URL || 'https://agentcache.ai';
// We need the API_KEY here too. It was global in server.ts.
// Best practice: The context should probably provide a way to make these calls, OR we extract the API client.

async function callAgentCacheAPI(endpoint: string, method: string, body?: any, apiKey?: string): Promise<any> {
    const key = apiKey || process.env.AGENTCACHE_API_KEY || process.env.API_KEY || 'ac_demo_test123';
    const url = `${AGENTCACHE_API_URL}${endpoint}`;
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': key,
        },
    };

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json() as any;

    if (!response.ok) {
        throw new Error(`AgentCache API error: ${data.error || response.statusText}`);
    }

    return data;
}

export const CoreTools: ToolModule = {
    tools: [
        {
            name: 'agentcache_get',
            description: 'Check if a prompt response exists in cache and retrieve it. Returns cached LLM response if available, reducing latency by 10x and costs by 90%.',
            inputSchema: {
                type: 'object',
                properties: {
                    provider: { type: 'string', enum: ['openai', 'anthropic', 'google'], description: 'LLM provider name' },
                    model: { type: 'string', description: 'Model identifier (e.g., gpt-4, claude-3-opus)' },
                    messages: {
                        type: 'array',
                        description: 'Conversation messages',
                        items: {
                            type: 'object',
                            properties: { role: { type: 'string' }, content: { type: 'string' } },
                            required: ['role', 'content'],
                        },
                    },
                    temperature: { type: 'number', description: 'Temperature parameter (default: 0.7)' },
                    namespace: { type: 'string', description: 'Optional cache namespace for multi-tenancy' },
                },
                required: ['provider', 'model', 'messages'],
            },
        },
        {
            name: 'agentcache_set',
            description: 'Store an LLM response in cache for future reuse. Call this after receiving a response from your LLM provider to enable caching.',
            inputSchema: {
                type: 'object',
                properties: {
                    provider: { type: 'string' },
                    model: { type: 'string' },
                    messages: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { role: { type: 'string' }, content: { type: 'string' } },
                        },
                    },
                    temperature: { type: 'number' },
                    response: { type: 'object', description: 'LLM response to cache' },
                    namespace: { type: 'string' },
                    ttl: { type: 'number', description: 'Cache TTL in seconds (default: 604800 = 7 days)' },
                },
                required: ['provider', 'model', 'messages', 'response'],
            },
        },
        {
            name: 'agentcache_check',
            description: 'Check if a prompt is cached without retrieving the full response. Useful for cache hit rate monitoring.',
            inputSchema: {
                type: 'object',
                properties: {
                    provider: { type: 'string' },
                    model: { type: 'string' },
                    messages: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { role: { type: 'string' }, content: { type: 'string' } },
                        },
                    },
                    temperature: { type: 'number' },
                    namespace: { type: 'string' },
                },
                required: ['provider', 'model', 'messages'],
            },
        },
        {
            name: 'agentcache_stats',
            description: 'Get caching statistics and quota information. View your cache hit rate, tokens saved, cost savings, and remaining quota.',
            inputSchema: {
                type: 'object',
                properties: {
                    period: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Time period for statistics' },
                    namespace: { type: 'string', description: 'Optional namespace filter' },
                },
            },
        },
    ],
    handlers: {
        agentcache_get: async (args, context) => {
            const params = CacheGetSchema.parse(args);

            // SECURITY: Validate namespace
            const nsValidation = SecurityMiddleware.validateNamespace(params.namespace);
            if (!nsValidation.valid) {
                context.auditLogger.log({
                    timestamp: Date.now(),
                    operation: 'get',
                    apiKeyHash: hashAPIKey(context.apiKey),
                    namespace: params.namespace,
                    result: 'blocked',
                    threats: nsValidation.threats
                });

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ error: nsValidation.reason }, null, 2)
                    }],
                    isError: true
                };
            }

            // SECURITY: Detect adversarial prompts
            for (const msg of params.messages) {
                const promptValidation = SecurityMiddleware.detectAdversarialPrompt(msg.content);
                if (!promptValidation.valid) {
                    context.auditLogger.log({
                        timestamp: Date.now(),
                        operation: 'get',
                        apiKeyHash: hashAPIKey(context.apiKey),
                        namespace: params.namespace,
                        result: 'blocked',
                        threats: promptValidation.threats
                    });
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                error: 'Security threat detected',
                                details: promptValidation.reason
                            }, null, 2)
                        }],
                        isError: true
                    };
                }
            }

            const result = await callAgentCacheAPI('/api/cache/get', 'POST', params, context.apiKey);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        },
        agentcache_set: async (args, context) => {
            const params = CacheSetSchema.parse(args);
            const result = await callAgentCacheAPI('/api/cache/set', 'POST', params, context.apiKey);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        },
        agentcache_check: async (args, context) => {
            const params = CacheCheckSchema.parse(args);
            const result = await callAgentCacheAPI('/api/cache/check', 'POST', params, context.apiKey);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        },
        agentcache_stats: async (args, context) => {
            const params = CacheStatsSchema.parse(args);
            const queryParams = new URLSearchParams();
            if (params.period) queryParams.append('period', params.period);
            if (params.namespace) queryParams.append('namespace', params.namespace);

            const result = await callAgentCacheAPI(`/api/stats?${queryParams}`, 'GET', undefined, context.apiKey);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        },
    }
};
