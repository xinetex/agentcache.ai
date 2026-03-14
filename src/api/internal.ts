/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */
import crypto from 'crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { TrustCenter } from '../infrastructure/TrustCenter.js';
import { semanticCacheService } from '../services/SemanticCacheService.js';
import { memoryFabricAnalyticsService } from '../services/MemoryFabricAnalyticsService.js';
import { browserProofService } from '../services/BrowserProofService.js';
import { buildSignedOntologyProvenance } from '../services/OntologyProvenanceService.js';
import { memoryFabricPolicyService } from '../services/MemoryFabricPolicyService.js';

const internalRouter = new Hono();
const trustCenter = new TrustCenter();
const REQUEST_TTL_MS = 5 * 60 * 1000;

const TrustStatusSchema = z.object({
    format: z.enum(['json', 'oscal']).optional().default('json'),
});

const CacheEnvelopeSchema = z.object({
    messages: z.array(z.record(z.string(), z.any())).min(1),
    model: z.string().optional().default('gpt-4o'),
    provider: z.string().optional().default('openai'),
    temperature: z.number().optional(),
    verticalSku: z.string().optional(),
    sessionId: z.string().optional(),
    turnIndex: z.number().int().optional(),
});

const CacheGetSchema = CacheEnvelopeSchema.extend({
    sector: z.string().optional(),
    semantic: z.boolean().optional(),
    previous_query: z.string().optional(),
    target_ip: z.string().optional(),
    target_banner: z.string().optional(),
});

const CacheSetSchema = CacheEnvelopeSchema.extend({
    sector: z.string().optional(),
    response: z.union([z.string(), z.record(z.string(), z.any())]),
    ttl: z.number().int().positive().optional(),
    circleId: z.string().optional(),
    originAgent: z.string().optional(),
});

const BrowserProofSchema = z.object({
    url: z.string().url(),
    expectedSelectors: z.array(z.string()).optional().default([]),
    expectedText: z.array(z.string()).optional().default([]),
    sector: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    waitForMs: z.number().int().min(0).optional(),
    includeMarkdown: z.boolean().optional().default(true),
});

function getProviderSecret(): string {
    return (process.env.AGENTCACHE_PROVIDER_SECRET || '').trim();
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function buildSignaturePayload(input: {
    requestId: string;
    timestamp: string;
    sku: string;
    method: string;
    path: string;
    body: unknown;
}): string {
    return [
        input.requestId,
        input.timestamp,
        input.sku,
        input.method,
        input.path,
        stableStringify(input.body ?? null),
    ].join('\n');
}

function verifySignature(input: {
    requestId: string;
    timestamp: string;
    sku: string;
    signature: string;
    method: string;
    paths: string[];
    body: unknown;
}): boolean {
    const secret = getProviderSecret();
    if (!secret) return false;

    for (const path of input.paths) {
        const expected = crypto
            .createHmac('sha256', secret)
            .update(buildSignaturePayload({
                requestId: input.requestId,
                timestamp: input.timestamp,
                sku: input.sku,
                method: input.method,
                path,
                body: input.body,
            }))
            .digest('hex');

        if (expected.length !== input.signature.length) continue;

        try {
            if (crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(input.signature, 'utf8'))) {
                return true;
            }
        } catch {
            return false;
        }
    }

    return false;
}

function buildPostureSummary(trustStatus: any) {
    const integrity = Boolean(trustStatus?.system?.integrity);
    const sentinelActive = Boolean(trustStatus?.sentinel?.active);
    const fedrampReady = Boolean(trustStatus?.compliance?.fedramp_ready);
    const status = integrity && sentinelActive ? 'stable' : 'degraded';

    return {
        status,
        integrity,
        sentinelActive,
        fedrampReady,
        environment: trustStatus?.system?.environment || 'unknown',
    };
}

function extractPromptText(messages: Array<Record<string, any>>): string {
    return messages
        .map((message) => (typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? '')))
        .join('\n');
}

async function parseVerifiedBody<T>(
    c: any,
    schema: z.ZodSchema<T>
): Promise<{ ok: true; requestId: string; sku: string; data: T } | { ok: false; response: Response }> {
    const providerSecret = getProviderSecret();
    if (!providerSecret) {
        return { ok: false, response: c.json({ error: 'Provider route is not configured.' }, 503) };
    }

    const requestId = c.req.header('X-Maxxeval-Request-Id') || '';
    const sku = c.req.header('X-Maxxeval-Sku') || '';
    const timestamp = c.req.header('X-Maxxeval-Timestamp') || '';
    const signature = c.req.header('X-Maxxeval-Signature') || '';

    if (!requestId || !sku || !timestamp || !signature) {
        return { ok: false, response: c.json({ error: 'Missing provider authentication headers.' }, 401) };
    }

    const requestTime = Date.parse(timestamp);
    if (!Number.isFinite(requestTime) || Math.abs(Date.now() - requestTime) > REQUEST_TTL_MS) {
        return { ok: false, response: c.json({ error: 'Provider request timestamp is invalid or expired.' }, 401) };
    }

    const rawBody = await c.req.text();
    let parsedBody: unknown = {};

    if (rawBody.trim().length > 0) {
        try {
            parsedBody = JSON.parse(rawBody);
        } catch {
            return { ok: false, response: c.json({ error: 'Invalid JSON body.' }, 400) };
        }
    }

    const parsed = schema.safeParse(parsedBody);
    if (!parsed.success) {
        return {
            ok: false,
            response: c.json({ error: 'Invalid provider request body.', issues: parsed.error.issues }, 400),
        };
    }

    if (!verifySignature({
        requestId,
        timestamp,
        sku,
        signature,
        method: c.req.method,
        paths: [c.req.path, `/api/internal${c.req.path}`],
        body: parsed.data,
    })) {
        return { ok: false, response: c.json({ error: 'Invalid provider signature.' }, 401) };
    }

    return {
        ok: true,
        requestId,
        sku,
        data: parsed.data,
    };
}

internalRouter.post('/trust-status', async (c) => {
    const parsed = await parseVerifiedBody(c, TrustStatusSchema);
    if (parsed.ok === false) return parsed.response;

    try {
        const trustStatus = parsed.data.format === 'oscal'
            ? await trustCenter.generateOSCAL()
            : await trustCenter.getTrustStatus();
        const posture = buildPostureSummary(parsed.data.format === 'oscal'
            ? {
                system: { integrity: true, environment: process.env.NODE_ENV || 'development' },
                sentinel: { active: true },
                compliance: { fedramp_ready: false },
            }
            : trustStatus);

        return c.json({
            requestId: parsed.requestId,
            sku: parsed.sku,
            provider: 'agentcache',
            format: parsed.data.format,
            generatedAt: new Date().toISOString(),
            posture,
            ontology: buildSignedOntologyProvenance({
                requestId: parsed.requestId,
                sku: parsed.sku,
                signClass: 'TELEMETRY',
                values: [
                    parsed.data.format,
                    posture.status,
                    trustStatus?.compliance,
                    trustStatus?.system,
                    'compliance',
                    'audit',
                ],
            }),
            trustStatus,
        });
    } catch (error: any) {
        return c.json({ error: error?.message || 'Failed to generate trust status.' }, 500);
    }
});

internalRouter.post('/cache/get', async (c) => {
    const parsed = await parseVerifiedBody(c, CacheGetSchema);
    if (parsed.ok === false) return parsed.response;

    try {
        const policy = memoryFabricPolicyService.resolve({
            sector: parsed.data.sector,
            verticalSku: parsed.data.verticalSku,
        });
        const result = await semanticCacheService.check({
            ...parsed.data,
            sector: policy.sectorId,
        });
        await memoryFabricAnalyticsService.recordOperation({
            policy,
            operation: 'read',
            hit: result.hit,
            promptText: extractPromptText(parsed.data.messages),
            responseText: typeof result.response === 'string' ? result.response : undefined,
        }).catch((error) => console.warn('[MemoryFabricAnalytics] Failed to record provider read:', error));
        return c.json({
            requestId: parsed.requestId,
            sku: parsed.sku,
            provider: 'agentcache',
            operation: 'cache/get',
            generatedAt: new Date().toISOString(),
            policy,
            ontology: buildSignedOntologyProvenance({
                requestId: parsed.requestId,
                sku: parsed.sku,
                signClass: 'PROMPT',
                sectorHint: policy.sectorId,
                values: [
                    policy.sectorId,
                    parsed.data.previous_query,
                    parsed.data.target_banner,
                    parsed.data.messages.map((message) => message.content),
                ],
            }),
            result,
        }, result.hit ? 200 : 404);
    } catch (error: any) {
        return c.json({ error: error?.message || 'Failed to resolve cache entry.' }, 500);
    }
});

internalRouter.post('/cache/set', async (c) => {
    const parsed = await parseVerifiedBody(c, CacheSetSchema);
    if (parsed.ok === false) return parsed.response;

    try {
        const policy = memoryFabricPolicyService.resolve({
            sector: parsed.data.sector,
            verticalSku: parsed.data.verticalSku,
        });
        const key = await semanticCacheService.set({
            ...parsed.data,
            sector: policy.sectorId,
            ttl: policy.effectiveTtlSeconds,
            response: typeof parsed.data.response === 'string'
                ? parsed.data.response
                : JSON.stringify(parsed.data.response),
        });
        await memoryFabricAnalyticsService.recordOperation({
            policy,
            operation: 'write',
            promptText: extractPromptText(parsed.data.messages),
            responseText: typeof parsed.data.response === 'string'
                ? parsed.data.response
                : JSON.stringify(parsed.data.response),
        }).catch((error) => console.warn('[MemoryFabricAnalytics] Failed to record provider write:', error));

        return c.json({
            requestId: parsed.requestId,
            sku: parsed.sku,
            provider: 'agentcache',
            operation: 'cache/set',
            generatedAt: new Date().toISOString(),
            policy,
            ontology: buildSignedOntologyProvenance({
                requestId: parsed.requestId,
                sku: parsed.sku,
                signClass: 'PROMPT',
                sectorHint: policy.sectorId,
                values: [
                    policy.sectorId,
                    parsed.data.circleId,
                    parsed.data.originAgent,
                    parsed.data.messages.map((message) => message.content),
                ],
            }),
            result: {
                success: true,
                key,
                keySuffix: key.slice(-16),
                ttl: policy.effectiveTtlSeconds,
            },
        });
    } catch (error: any) {
        return c.json({ error: error?.message || 'Failed to store cache entry.' }, 500);
    }
});

internalRouter.post('/browser-proof', async (c) => {
    const parsed = await parseVerifiedBody(c, BrowserProofSchema);
    if (parsed.ok === false) return parsed.response;

    try {
        const policy = memoryFabricPolicyService.resolve({
            sector: parsed.data.sector,
        });
        const result = await browserProofService.prove(parsed.data);
        await memoryFabricAnalyticsService.recordOperation({
            policy,
            operation: 'browser_proof',
            promptText: parsed.data.url,
            responseText: result.snapshot?.excerpt || undefined,
        }).catch((error) => console.warn('[MemoryFabricAnalytics] Failed to record browser proof:', error));
        return c.json({
            requestId: parsed.requestId,
            sku: parsed.sku,
            provider: 'agentcache',
            operation: 'browser-proof',
            generatedAt: new Date().toISOString(),
            policy,
            ontology: buildSignedOntologyProvenance({
                requestId: parsed.requestId,
                sku: parsed.sku,
                signClass: 'DOM',
                sectorHint: policy.sectorId,
                values: [
                    policy.sectorId,
                    parsed.data.url,
                    parsed.data.expectedSelectors,
                    parsed.data.expectedText,
                    result?.snapshot?.title,
                    result?.snapshot?.excerpt,
                ],
            }),
            result,
        });
    } catch (error: any) {
        return c.json({ error: error?.message || 'Failed to generate browser proof.' }, 500);
    }
});

export default internalRouter;
