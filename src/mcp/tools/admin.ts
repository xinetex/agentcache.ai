
import { z } from 'zod';
import { ToolModule } from '../registry.js';
import { TrustCenter } from '../../infrastructure/TrustCenter.js';

// Schemas
const CacheInvalidateSchema = z.object({
    pattern: z.string().optional().describe('Wildcard pattern (e.g., "news/*")'),
    namespace: z.string().optional().describe('Target namespace'),
    olderThan: z.number().optional().describe('Invalidate caches older than X milliseconds'),
    url: z.string().optional().describe('Invalidate caches from specific URL'),
    reason: z.string().optional().describe('Reason for invalidation (for audit log)'),
});

const RegisterListenerSchema = z.object({
    url: z.string().describe('URL to monitor for changes'),
    checkInterval: z.number().optional().default(900000).describe('Check interval in milliseconds (default: 900000 = 15min)'),
    namespace: z.string().optional().default('default').describe('Namespace to invalidate on change'),
    invalidateOnChange: z.boolean().optional().default(true).describe('Auto-invalidate on content change'),
    webhook: z.string().optional().describe('Webhook URL to notify on change'),
});

const SearchDocsSchema = z.object({
    query: z.string().describe('Search query for documentation'),
    limit: z.number().optional().default(3).describe('Number of results to return'),
});

const TrustStatusSchema = z.object({
    format: z.enum(['json', 'oscal']).optional().default('json').describe('Output format'),
});

// Services
// Note: In real world, we might want to dependency inject these or singleton them.
// For now, new instance is fine if stateless, but TrustCenter might maintain state.
// We'll instantiate here for this module.
const trustCenter = new TrustCenter();

// Helper API Call (Duplicated for now, should be shared lib)
const AGENTCACHE_API_URL = process.env.AGENTCACHE_API_URL || 'https://agentcache.ai';

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

export const AdminTools: ToolModule = {
    tools: [
        {
            name: 'agentcache_invalidate',
            description: 'Invalidate cached responses by pattern, namespace, age, or URL. Essential for robotics fleets and dynamic data scenarios.',
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'Wildcard pattern (e.g., "navigation/*", "pricing/*")' },
                    namespace: { type: 'string', description: 'Target namespace to invalidate' },
                    olderThan: { type: 'number', description: 'Invalidate caches older than X milliseconds' },
                    url: { type: 'string', description: 'Invalidate caches from specific source URL' },
                    reason: { type: 'string', description: 'Reason for invalidation (logged for audit)' },
                },
            },
        },
        {
            name: 'agentcache_register_listener',
            description: 'Register URL to monitor for content changes and auto-invalidate caches. Perfect for monitoring competitor pricing, API docs, or environmental sensors.',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL to monitor (required)' },
                    checkInterval: { type: 'number', description: 'Check interval in milliseconds (default: 900000 = 15min)' },
                    namespace: { type: 'string', description: 'Namespace to invalidate on change (default: "default")' },
                    invalidateOnChange: { type: 'boolean', description: 'Auto-invalidate namespace on content change (default: true)' },
                    webhook: { type: 'string', description: 'Webhook URL to notify on content change' },
                },
                required: ['url'],
            },
        },
        {
            name: 'search_docs',
            description: 'Search indexed documentation for context (RAG)',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query for documentation' },
                    limit: { type: 'number', description: 'Number of results to return (default: 3)' },
                },
                required: ['query'],
            },
        },
        {
            name: 'agentcache_trust_status',
            description: 'Get the current security and compliance status of the AgentCache system. Returns machine-readable evidence for FedRAMP/GRC verification.',
            inputSchema: {
                type: 'object',
                properties: {
                    format: { type: 'string', enum: ['json', 'oscal'], description: 'Output format (default: json)' },
                },
            },
        },
    ],
    handlers: {
        agentcache_invalidate: async (args, context) => {
            const params = CacheInvalidateSchema.parse(args);
            if (!params.pattern && !params.namespace && !params.olderThan && !params.url) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: 'Must provide at least one invalidation criterion',
                            criteria: ['pattern', 'namespace', 'olderThan', 'url']
                        }, null, 2)
                    }],
                    isError: true
                };
            }
            const result = await callAgentCacheAPI('/api/cache/invalidate', 'POST', params, context.apiKey);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        },
        agentcache_register_listener: async (args, context) => {
            const params = RegisterListenerSchema.parse(args);
            const result = await callAgentCacheAPI('/api/listeners/register', 'POST', params, context.apiKey);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        },
        search_docs: async (args, context) => {
            const params = SearchDocsSchema.parse(args);
            const result = await callAgentCacheAPI('/api/docs/search', 'POST', params, context.apiKey);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        },
        agentcache_trust_status: async (args, context) => {
            const params = TrustStatusSchema.parse(args);
            let result;
            if (params.format === 'oscal') {
                result = await trustCenter.generateOSCAL();
            } else {
                result = await trustCenter.getTrustStatus();
            }
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        },
    }
};
