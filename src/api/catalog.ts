/**
 * Service Catalog API
 *
 * Lists available AgentCache services and accepts custom cache/service requests.
 * This is the bridge from "need identified" → "service delivered."
 *
 * Public endpoints (no auth):
 *   GET  /api/catalog          — List all services
 *   GET  /api/catalog/:id      — Service detail + required inputs
 *
 * Authenticated endpoints:
 *   POST /api/catalog/request  — Submit a custom service request (need → ticket)
 *   GET  /api/catalog/requests — List open requests (admin or own)
 */

import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { serviceRequests } from '../db/schema.js';

const catalogRouter = new Hono();

// ============================================================================
// SERVICE DEFINITIONS
// ============================================================================

interface ServiceDef {
    id: string;
    name: string;
    category: 'cache' | 'intelligence' | 'infrastructure' | 'intake';
    description: string;
    tier: 'free' | 'pro' | 'enterprise';
    endpoint: string;
    requiredInputs: { field: string; type: string; description: string }[];
    optionalInputs: { field: string; type: string; description: string }[];
    pricing: string;
    status: 'available' | 'beta' | 'coming_soon';
}

const SERVICES: ServiceDef[] = [
    {
        id: 'semantic-cache',
        name: 'Semantic Cache',
        category: 'cache',
        description: 'LLM response caching with semantic similarity matching. Reduces API costs by up to 90% and response times by 10x.',
        tier: 'free',
        endpoint: 'POST /api/cache/check, POST /api/cache/get, POST /api/cache/set',
        requiredInputs: [
            { field: 'provider', type: 'string', description: 'LLM provider (openai, anthropic, moonshot, etc.)' },
            { field: 'model', type: 'string', description: 'Model identifier' },
            { field: 'messages', type: 'array', description: 'Chat messages array [{role, content}]' }
        ],
        optionalInputs: [
            { field: 'temperature', type: 'number', description: 'Sampling temperature (default: 0.7)' },
            { field: 'ttl', type: 'number', description: 'Time-to-live in seconds (default: 604800)' },
            { field: 'semantic', type: 'boolean', description: 'Enable semantic similarity matching' },
            { field: 'namespace', type: 'string', description: 'Cache namespace (Pro+ only)' }
        ],
        pricing: 'Free: 10K req/mo | Pro: 1M req/mo ($49/mo) | Enterprise: unlimited',
        status: 'available'
    },
    {
        id: 'tool-cache',
        name: 'Tool Result Cache',
        category: 'cache',
        description: 'Cache results from external tool/API calls so agents skip redundant work. Deterministic hashing ensures exact-match hits.',
        tier: 'free',
        endpoint: 'POST /api/cache/set (with namespace=tools)',
        requiredInputs: [
            { field: 'provider', type: 'string', description: 'Use "tool" as provider' },
            { field: 'model', type: 'string', description: 'Tool name (e.g., "web-search", "calculator")' },
            { field: 'messages', type: 'array', description: '[{role: "user", content: <tool_input_json>}]' }
        ],
        optionalInputs: [
            { field: 'ttl', type: 'number', description: 'TTL in seconds (shorter for volatile tools)' },
            { field: 'namespace', type: 'string', description: 'Namespace for isolation' }
        ],
        pricing: 'Included in cache quota',
        status: 'available'
    },
    {
        id: 'session-memory',
        name: 'Session Memory',
        category: 'cache',
        description: 'Persistent agent conversation memory with vector search recall. Store and retrieve past interactions across sessions.',
        tier: 'free',
        endpoint: 'POST /api/memory/store, POST /api/memory/recall, GET /api/memory/:id',
        requiredInputs: [
            { field: 'content', type: 'string', description: 'Memory content to store' }
        ],
        optionalInputs: [
            { field: 'metadata', type: 'object', description: 'Key-value metadata for filtering' },
            { field: 'namespace', type: 'string', description: 'Memory namespace' },
            { field: 'tags', type: 'array', description: 'Tags for categorization' }
        ],
        pricing: 'Free: 1K memories | Pro: 100K | Enterprise: unlimited',
        status: 'available'
    },
    {
        id: 'cdn-streaming',
        name: 'CDN & Streaming',
        category: 'infrastructure',
        description: 'Edge-accelerated content delivery with automatic HLS transcoding. Multi-region distribution with smart cache warming.',
        tier: 'pro',
        endpoint: 'GET /api/cdn/stream, POST /api/cdn/warm, POST /api/transcode/submit',
        requiredInputs: [
            { field: 'url', type: 'string', description: 'Source content URL or asset ID' }
        ],
        optionalInputs: [
            { field: 'quality', type: 'string', description: 'Target quality (240p, 360p, 720p, 1080p)' },
            { field: 'format', type: 'string', description: 'Output format (hls, mp4)' }
        ],
        pricing: '$0.03-0.08/GB bandwidth + $0.015/min transcoding',
        status: 'available'
    },
    {
        id: 'file-acceleration',
        name: 'File Acceleration',
        category: 'infrastructure',
        description: 'Distributed file storage with intelligent edge routing, deduplication, and multi-part upload acceleration.',
        tier: 'pro',
        endpoint: 'POST /api/edges/optimal, POST /api/jetty-speed/chunk',
        requiredInputs: [
            { field: 'fileId', type: 'string', description: 'Unique file identifier' }
        ],
        optionalInputs: [
            { field: 'lat', type: 'number', description: 'Client latitude for edge selection' },
            { field: 'lng', type: 'number', description: 'Client longitude' },
            { field: 'priority', type: 'string', description: 'Optimization priority: speed | cost | balanced' }
        ],
        pricing: '$0.023/GB storage + $0.05/GB egress',
        status: 'available'
    },
    {
        id: 'needs-intake',
        name: 'Needs Intake (Focus Group)',
        category: 'intake',
        description: 'Report missing capabilities, friction points, and workflow patterns. MaxxEval is system of record — signals feed into the AgentCache service pipeline.',
        tier: 'free',
        endpoint: 'POST /api/hub/focus-groups/onboarding/join, GET /api/needs, GET /api/needs/trends',
        requiredInputs: [
            { field: 'Authorization', type: 'header', description: 'Bearer <api_key> from hub registration' }
        ],
        optionalInputs: [
            { field: 'type', type: 'query', description: 'Filter needs by type: missing_capability | friction | pattern' }
        ],
        pricing: 'Free — earn badges (Scout → Analyst → Oracle)',
        status: 'available'
    },
    {
        id: 'anti-cache',
        name: 'Anti-Cache (Invalidation)',
        category: 'intelligence',
        description: 'Active cache invalidation engine. Monitor URLs for changes, auto-invalidate stale entries, freshness scoring.',
        tier: 'free',
        endpoint: 'POST /api/cache/invalidate, POST /api/listeners/register, GET /api/listeners',
        requiredInputs: [
            { field: 'pattern', type: 'string', description: 'Cache key pattern to invalidate (or URL for listeners)' }
        ],
        optionalInputs: [
            { field: 'namespace', type: 'string', description: 'Limit to namespace' },
            { field: 'olderThan', type: 'number', description: 'Invalidate entries older than N ms' },
            { field: 'webhook', type: 'string', description: 'Webhook URL for change notifications' }
        ],
        pricing: 'Included in cache quota',
        status: 'available'
    },
    {
        id: 'security-guardrails',
        name: 'Security Guardrails',
        category: 'intelligence',
        description: 'Prompt injection and jailbreak detection. Pre-execution input validation to protect agent workflows.',
        tier: 'free',
        endpoint: 'POST /api/security/check',
        requiredInputs: [
            { field: 'input', type: 'string', description: 'User input to validate' }
        ],
        optionalInputs: [
            { field: 'context', type: 'string', description: 'Additional context for classification' }
        ],
        pricing: 'Free: 1K checks/mo | Pro: 100K',
        status: 'available'
    },
    {
        id: 'plan-cache',
        name: 'Agentic Plan Cache',
        category: 'cache',
        description: 'Cache entire agent execution plans (multi-step workflows). Replay cached plans to skip redundant LLM calls.',
        tier: 'pro',
        endpoint: 'POST /api/pipeline/*',
        requiredInputs: [
            { field: 'planHash', type: 'string', description: 'Hash of the plan intent/structure' },
            { field: 'inputHash', type: 'string', description: 'Hash of the specific inputs' }
        ],
        optionalInputs: [
            { field: 'templateId', type: 'string', description: 'Pre-built plan template ID' }
        ],
        pricing: 'Pro tier — included in quota',
        status: 'beta'
    },
    {
        id: 'overflow-partner',
        name: 'Elastic Overflow (Partner)',
        category: 'infrastructure',
        description: 'Use AgentCache as overflow/fallback cache for partner services (Redis, Pinecone, Together.ai). Revenue share model.',
        tier: 'enterprise',
        endpoint: 'POST /api/overflow',
        requiredInputs: [
            { field: 'x-partner-id', type: 'header', description: 'Partner ID' },
            { field: 'x-partner-key', type: 'header', description: 'Partner API key' },
            { field: 'customer_id', type: 'string', description: 'End customer ID' },
            { field: 'original_request', type: 'object', description: 'Original LLM request payload' }
        ],
        optionalInputs: [
            { field: 'action', type: 'string', description: '"get" (default) or "set"' }
        ],
        pricing: 'Revenue share: 20-30% of cost savings',
        status: 'available'
    }
];

const SERVICE_MAP = new Map(SERVICES.map(s => [s.id, s]));

// ============================================================================
// CATALOG ENDPOINTS
// ============================================================================

/**
 * GET /api/catalog
 * List all available services (public, no auth)
 */
catalogRouter.get('/', (c) => {
    const category = c.req.query('category');
    const tier = c.req.query('tier');
    const status = c.req.query('status');

    let filtered = SERVICES;
    if (category) filtered = filtered.filter(s => s.category === category);
    if (tier) filtered = filtered.filter(s => s.tier === tier);
    if (status) filtered = filtered.filter(s => s.status === status);

    return c.json({
        count: filtered.length,
        services: filtered.map(s => ({
            id: s.id,
            name: s.name,
            category: s.category,
            description: s.description,
            tier: s.tier,
            pricing: s.pricing,
            status: s.status
        }))
    });
});

/**
 * GET /api/catalog/:id
 * Full detail for a specific service (public)
 */
catalogRouter.get('/:id', (c) => {
    const service = SERVICE_MAP.get(c.req.param('id'));
    if (!service) {
        return c.json({ error: 'Service not found' }, 404);
    }
    return c.json({ service });
});

// ============================================================================
// CUSTOM SERVICE REQUESTS
// ============================================================================

/**
 * POST /api/catalog/request
 * Submit a custom service/cache request.
 * Turns a demand signal (need) into an actionable ticket.
 */
catalogRouter.post('/request', async (c) => {
    try {
        const body = await c.req.json();
        const { serviceId, title, description, config, agentId, needSignalId } = body;

        if (!serviceId || !title) {
            return c.json({ error: 'serviceId and title are required' }, 400);
        }

        // Validate service exists
        if (!SERVICE_MAP.has(serviceId) && serviceId !== 'custom') {
            return c.json({
                error: 'Unknown serviceId',
                availableServices: SERVICES.map(s => s.id)
            }, 400);
        }

        const now = new Date();
        const result = await db.insert(serviceRequests).values({
            agentId: agentId || null,
            serviceId,
            needSignalId: needSignalId || null,
            title,
            description: description || null,
            status: 'open',
            config: config || {},
            createdAt: now,
            updatedAt: now
        }).returning();

        const inserted = Array.isArray(result) && result.length > 0 ? result[0] : null;

        return c.json({
            success: true,
            requestId: inserted?.id || 'pending',
            status: 'open',
            message: 'Service request submitted. Our team + agents will review and propose a configuration.',
            trackEndpoint: 'GET /api/catalog/requests'
        }, 201);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * GET /api/catalog/requests
 * List service requests. Optional ?status= and ?agentId= filters.
 */
catalogRouter.get('/requests', async (c) => {
    const status = c.req.query('status');
    const agentId = c.req.query('agentId');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 50;

    try {
        let query = db.select().from(serviceRequests);
        if (status) {
            query = query.where(eq(serviceRequests.status, status));
        }
        if (agentId) {
            query = query.where(eq(serviceRequests.agentId, agentId));
        }

        const rows = await query
            .orderBy(desc(serviceRequests.createdAt))
            .limit(limit);

        return c.json({
            count: rows.length,
            requests: rows
        });
    } catch {
        return c.json({ count: 0, requests: [] });
    }
});

export default catalogRouter;
