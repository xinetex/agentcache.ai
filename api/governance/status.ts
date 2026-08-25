// api/governance/status.ts
//
// GET /api/governance/status[?days=30]
//   Headers: Authorization: Bearer ac_...
//
// The governance console's read model: current spend vs budget, request volume
// vs quota, spend-anomaly flag, kill-switch state, and the net-dollars-saved
// this window — plus the live gate verdict for a $0 probe call. One request the
// UI can render the whole control plane from.

import { validateApiKey } from '../../lib/api-key-middleware.js';
import { decide } from '../../lib/governance.js';
import { loadPolicy, loadUsage } from '../../lib/governance-data.js';

export const config = { runtime: 'nodejs' };
import { ensureGovernanceSchema } from '../../lib/ensure-schema.js';
import { sql } from '../../lib/neon.js';

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default async function handler(req: Request) {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!apiKey || !apiKey.startsWith('ac_')) return json({ error: 'Unauthorized', message: 'Valid AgentCache API key required' }, 401);

    let keyContext: any;
    try { keyContext = await validateApiKey(apiKey); }
    catch (e: any) { return json({ error: 'Unauthorized', message: e.message }, 401); }

    const url = new URL(req.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
    const orgId = keyContext.organizationId;

    await ensureGovernanceSchema(sql).catch(() => {});
    const [policy, usage] = await Promise.all([loadPolicy(sql, orgId), loadUsage(sql, orgId, days)]);

    // Verdict for a zero-cost probe — shows the standing posture (ok/warn/block)
    // without a specific call in hand.
    const verdict = decide(policy, {
      spentUsd: usage.spentUsd,
      usedRequests: usage.usedRequests,
      estCostUsd: 0,
      series: usage.series,
    });

    return json({
      organizationSlug: keyContext.organizationSlug,
      windowDays: days,
      policy,
      usage: {
        spentUsd: usage.spentUsd,
        usedRequests: usage.usedRequests,
        savedUsd: usage.savedUsd,
        budgetRemainingUsd: verdict.budget?.remainingUsd ?? null,
        quotaRemaining: verdict.quota?.remaining ?? null,
      },
      posture: {
        severity: verdict.severity,
        allow: verdict.allow,
        reasons: verdict.reasons,
        anomaly: verdict.anomaly,
      },
      series: usage.series,
    });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
