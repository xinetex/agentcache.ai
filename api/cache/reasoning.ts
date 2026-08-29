// api/cache/reasoning.ts
//
// AgentCache — Reasoning / State Cache (Move 4: the moat).
//
// POST /api/cache/reasoning
//   Headers: Authorization: Bearer ac_...   (or X-API-Key)
//            X-Cache-Namespace: <namespace>
//            X-Model: <model>               (optional, for savings valuation)
//   Body:
//     { action: 'resume', agentId, task, query?, maxChars? }
//       -> returns the bounded reasoning state carried from prior runs of this
//          (agent, task). On a real resume (runs > 0) it logs a 'reasoning'
//          savings hit valued at the carried tokens.
//     { action: 'commit', agentId, task, delta }
//       -> merges { facts?, decisions?, scratch? } into the stored state and
//          returns the new run count.
//
// Conventions mirror api/cache/prefix.ts: ac_ auth via api-key-middleware,
// required X-Cache-Namespace with org-scoped access check, org_slug:namespace
// key prefixing (here extended to reason:<agent>:<taskHash>), lazy Redis, and
// 200-with-status responses (a cold task with no prior state is a normal miss,
// never an error).

import { Redis } from '@upstash/redis';
import { neon } from '@neondatabase/serverless';
import { validateApiKey, validateNamespaceAccess } from '../../lib/api-key-middleware.js';
import { taskFingerprint, makeKey, mergeState, summarizeCarry } from '../../lib/reasoning-cache.js';
import { recordHit } from '../../lib/savings-recorder.js';

export const config = { runtime: 'nodejs' };

// Reasoning state is durable working memory — longer-lived than a prefix
// fingerprint but still bounded. 30 days by default.
const REASONING_TTL_SECONDS = 60 * 60 * 24 * 30;

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Cache store not configured');
  _redis = new Redis({ url, token });
  return _redis;
}

import { ensureSavingsSchema } from '../../lib/ensure-schema.js';
const sql = neon(process.env.DATABASE_URL!);
ensureSavingsSchema(sql).catch(() => {}); // self-provision on cold start

function json(obj: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store', ...extra },
  });
}

async function handler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!apiKey || !apiKey.startsWith('ac_')) {
      return json({ error: 'Unauthorized', message: 'Valid AgentCache API key required' }, 401);
    }

    let keyContext: any;
    try { keyContext = await validateApiKey(apiKey); }
    catch (error: any) { return json({ error: 'Unauthorized', message: error.message }, 401); }

    const namespace = req.headers.get('X-Cache-Namespace');
    if (!namespace) return json({ error: 'Bad Request', message: 'X-Cache-Namespace header required' }, 400);
    try { validateNamespaceAccess(keyContext, namespace); }
    catch (error: any) { return json({ error: 'Forbidden', message: error.message }, 403); }

    const body: any = (await req.json().catch(() => null)) || {};
    const action = body.action === 'commit' ? 'commit' : 'resume';
    if (body.task == null) return json({ error: 'Bad Request', message: 'task required' }, 400);

    const agentId = typeof body.agentId === 'string' && body.agentId ? body.agentId : 'default';
    const taskHash = taskFingerprint(body.task);
    const key = makeKey({ orgSlug: keyContext.organizationSlug, namespace, agentId, taskHash });

    const redis = getRedis();
    const prev = (await redis.get<any>(key)) || null;

    if (action === 'commit') {
      const next = mergeState(prev, body.delta || {}, new Date().toISOString());
      await redis.set(key, next, { ex: REASONING_TTL_SECONDS });
      return json(
        { committed: true, taskHash, agentId, runs: next.runs, facts: next.facts.length, decisions: next.decisions.length, namespace, organizationSlug: keyContext.organizationSlug },
        200,
        { 'X-Cache-Status': 'REASONING-COMMIT', 'X-Cache-Namespace': namespace },
      );
    }

    // resume
    const hasPrior = !!prev && (prev.runs || 0) > 0;
    const { carry, tokensApprox, runs } = summarizeCarry(prev || {}, {
      maxChars: typeof body.maxChars === 'number' ? body.maxChars : 6000,
      query: typeof body.query === 'string' ? body.query : '',
    });

    // A real resume re-uses prior reasoning in place of regenerating it: value it
    // as an avoided input-side call at the carried-token count. Ledger-only.
    if (hasPrior && tokensApprox > 0) {
      recordHit({ sql }, {
        organizationId: keyContext.organizationId,
        namespace,
        agentId,
        event: { layer: 'reasoning', model: req.headers.get('X-Model') || 'unknown', inputTokens: tokensApprox },
      }).catch((err: any) => console.error('Failed to record reasoning hit:', err));
    }

    return json(
      { hit: hasPrior, taskHash, agentId, runs, carry, carriedTokensApprox: tokensApprox, namespace, organizationSlug: keyContext.organizationSlug },
      200,
      { 'X-Cache-Status': hasPrior ? 'REASONING-HIT' : 'REASONING-MISS', 'X-Cache-Namespace': namespace },
    );
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}

export { handler as POST };
