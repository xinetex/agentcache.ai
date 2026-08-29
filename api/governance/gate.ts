// api/governance/gate.ts
//
// POST /api/governance/gate
//   Headers: Authorization: Bearer ac_...
//   Body: { model: string, inputTokens?: number, outputTokens?: number }
//
// The enforcement point. Given a PROPOSED model call, prices it, folds in the
// org's current spend/quota/anomaly posture, and returns a deterministic
// allow/deny BEFORE the money is spent. This is the thing OpenRouter/Stripe do
// not do: govern the call, not just bill it.
//
//   200 { allow: true,  severity, estCostUsd, ... }   -> proceed
//   200 { allow: false, severity: 'block', reasons }  -> deny (agent should stop)
//
// Returns 200 even on deny — a denied call is a normal governed outcome, not an
// HTTP error (same contract discipline as the cache miss path).

import { validateApiKey } from '../../lib/api-key-middleware.js';
import { decide } from '../../lib/governance.js';
import { loadPolicy, loadUsage } from '../../lib/governance-data.js';
import { getPrice, round2 } from '../../lib/savings.js';

export const config = { runtime: 'nodejs' };
import { ensureGovernanceSchema } from '../../lib/ensure-schema.js';
import { sql } from '../../lib/neon.js';

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' },
  });
}

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): { estCostUsd: number; priced: boolean } {
  const price: any = getPrice(model);
  if (!price) return { estCostUsd: 0, priced: false }; // unknown model -> cannot price; do not fabricate a ceiling
  const usd = inputTokens * (price.in / 1_000_000) + outputTokens * (price.out / 1_000_000);
  return { estCostUsd: round2(usd), priced: true };
}

async function handler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!apiKey || !apiKey.startsWith('ac_')) return json({ error: 'Unauthorized', message: 'Valid AgentCache API key required' }, 401);

    let keyContext: any;
    try { keyContext = await validateApiKey(apiKey); }
    catch (e: any) { return json({ error: 'Unauthorized', message: e.message }, 401); }

    const body: any = (await req.json().catch(() => ({}))) || {};
    const model = typeof body.model === 'string' ? body.model : 'unknown';
    const inputTokens = Math.max(0, Number(body.inputTokens) || 0);
    const outputTokens = Math.max(0, Number(body.outputTokens) || 0);
    const orgId = keyContext.organizationId;

    await ensureGovernanceSchema(sql).catch(() => {});
    const [policy, usage] = await Promise.all([loadPolicy(sql, orgId), loadUsage(sql, orgId, 30)]);
    const { estCostUsd, priced } = estimateCostUsd(model, inputTokens, outputTokens);

    const verdict = decide(policy, {
      spentUsd: usage.spentUsd,
      usedRequests: usage.usedRequests,
      estCostUsd,
      series: usage.series,
    });

    return json({
      organizationSlug: keyContext.organizationSlug,
      model,
      estCostUsd,
      priced, // false = model not in price table; budget dimension advisory only
      allow: verdict.allow,
      severity: verdict.severity,
      reasons: verdict.reasons,
      budget: verdict.budget,
      quota: verdict.quota,
      anomaly: verdict.anomaly,
    });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}

export { handler as POST };
