// api/cache/prefix.ts
//
// AgentCache — Prompt Prefix Cache.
//
// POST /api/cache/prefix
//   Headers: Authorization: Bearer ac_...   (or X-API-Key)
//            X-Cache-Namespace: <namespace>
//   Body:    { sessionId?: string, messages: Message[], minPrefixMessages?: number, annotate?: boolean }
//
// Returns how much of the current prompt is an unchanged prefix of this
// session's previous turn, and where a provider prompt-cache breakpoint should
// be placed. This is the highest-ROI, lowest-risk caching layer for agentic
// loops, which resend a large stable prefix on every step.
//
// Conventions mirror api/cache/get.ts: ac_ key auth via api-key-middleware,
// required X-Cache-Namespace with org-scoped access check, org_slug:namespace
// key prefixing for tenant isolation, 200-with-status body (never an error on a
// normal miss), and X-Cache-* response headers.

import { Redis } from '@upstash/redis';
import { neon } from '@neondatabase/serverless';
import { validateApiKey, validateNamespaceAccess, recordUsage } from '../../lib/api-key-middleware.js';
import { computePrefixReuse, planBreakpoints } from '../../lib/prefix-cache.js';
import { recordHit, hitEventFromHeaders } from '../../lib/savings-recorder.js';

export const config = {
  runtime: 'nodejs',
};

// Lazily construct the client so a missing env var yields a clean 500 at
// request time rather than a cold import-time crash (addresses the
// module-level non-null-assertion note from the July 29 review).
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Cache store not configured');
  _redis = new Redis({ url, token });
  return _redis;
}

// Ledger writer for the Savings Engine (Move 1). neon() does not open a
// connection at construction, so this is safe at module scope.
import { ensureSavingsSchema } from '../../lib/ensure-schema.js';
const sql = neon(process.env.DATABASE_URL!);
ensureSavingsSchema(sql).catch(() => {}); // self-provision on cold start

// Session prefix fingerprints are short-lived working state, not durable data.
const PREFIX_TTL_SECONDS = 60 * 60 * 24; // 24h

function json(obj: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // --- auth (same scheme as get.ts) ---
    const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!apiKey || !apiKey.startsWith('ac_')) {
      return json({ error: 'Unauthorized', message: 'Valid AgentCache API key required' }, 401);
    }

    let keyContext: any;
    try {
      keyContext = await validateApiKey(apiKey);
    } catch (error: any) {
      return json({ error: 'Unauthorized', message: error.message }, 401);
    }

    // --- namespace isolation ---
    const namespace = req.headers.get('X-Cache-Namespace');
    if (!namespace) {
      return json({ error: 'Bad Request', message: 'X-Cache-Namespace header required' }, 400);
    }
    try {
      validateNamespaceAccess(keyContext, namespace);
    } catch (error: any) {
      return json({ error: 'Forbidden', message: error.message }, 403);
    }

    // --- input ---
    const body: any = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: 'Bad Request', message: 'messages[] required (non-empty)' }, 400);
    }
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId : 'default';

    // Tenant + session isolated key. Same org_slug:namespace: prefix as the
    // exact-match cache, extended with a prefix:<session> segment.
    const prefixKey = `${keyContext.organizationSlug}:${namespace}:prefix:${sessionId}`;

    const redis = getRedis();
    const prev = (await redis.get<string[]>(prefixKey)) || null;

    const result = computePrefixReuse(prev, body.messages, {
      minPrefixMessages: typeof body.minPrefixMessages === 'number' ? body.minPrefixMessages : 1,
    });

    // Persist this turn's fingerprint for the next comparison.
    await redis.set(prefixKey, result.curHashes, { ex: PREFIX_TTL_SECONDS });

    // Usage accounting: a prefix hit is a real saved-work event.
    recordUsage(keyContext.organizationId, namespace, {
      requests: 1,
      hits: result.hit ? 1 : 0,
      misses: result.hit ? 0 : 1,
    }).catch((err: any) => console.error('Failed to record usage:', err));

    // Move 1: a prefix hit is a real saved-work event. Append a priced row to
    // the savings ledger (layer:'prefix'). prefixTokens come from X-Prefix-Tokens
    // (the shared front billed at the cache-read rate); model from X-Model.
    // Ledger-only — recordUsage above already handled the daily aggregate.
    if (result.hit) {
      recordHit({ sql }, {
        organizationId: keyContext.organizationId,
        namespace,
        sessionId,
        event: hitEventFromHeaders(req.headers, 'prefix'),
      }).catch((err: any) => console.error('Failed to record savings hit:', err));
    }

    const annotated = body.annotate ? planBreakpoints(body.messages, result.breakpointIndex) : undefined;

    // Strip the internal fingerprint before returning.
    const { curHashes, ...publicResult } = result;

    return json(
      {
        ...publicResult,
        sessionId,
        namespace,
        organizationSlug: keyContext.organizationSlug,
        ...(annotated ? { messages: annotated } : {}),
      },
      200,
      {
        'X-Cache-Status': result.hit ? 'PREFIX-HIT' : 'PREFIX-MISS',
        'X-Cache-Namespace': namespace,
      },
    );
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
