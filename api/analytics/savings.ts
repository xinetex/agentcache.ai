// api/analytics/savings.ts
//
// GET /api/analytics/savings?days=30[&planCostUsd=99]
//   Headers: Authorization: Bearer ac_...   (or X-API-Key)
//
// The revenue-facing endpoint. Reads the immutable savings_events ledger for
// the caller's org over a window, runs it through the pure Savings Engine
// (lib/savings.js), and returns net dollars saved, ROI, and per-model /
// per-layer / daily breakdowns. This is the number the governance console and
// the value-based invoice are both computed from.
//
// Auth + tenant scoping mirror api/cache/get.ts (ac_ key, org-scoped rows).

import { validateApiKey } from '../../lib/api-key-middleware.js';
import { round2 } from '../../lib/savings.js';

export const config = { runtime: 'nodejs' };

import { ensureSavingsSchema } from '../../lib/ensure-schema.js';
import { sql } from '../../lib/neon.js';

// Monthly list price by plan tier. Operator-configurable; a ?planCostUsd query
// param overrides for what-if analysis. Prorated to the requested window so ROI
// is meaningful for any range.
const PLAN_COST_USD: Record<string, number> = {
  // Canonical monthly USD, aligned to src/config/tiers.ts + api/pricing.js +
  // the Stripe webhook amounts (pro 9900, business 29900). "starter" is the
  // free-tier default label used by api/account.js (quota 10k), so it is $0.
  free: 0, starter: 0, pro: 99, business: 299, enterprise: 299,
};

function json(obj: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store', ...extra },
  });
}

export default async function handler(req: Request) {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
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

    const url = new URL(req.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);

    // Ensure the ledger table exists (memoized, bounded, fail-open), then
    // pull this org's rows for the window (tenant-scoped).
    await ensureSavingsSchema(sql).catch(() => {});
    const rows: any[] = await sql`
      SELECT layer, model, saved_tokens, saved_usd, ts
      FROM savings_events
      WHERE organization_id = ${keyContext.organizationId}
        AND ts >= NOW() - (${days} || ' days')::interval
      ORDER BY ts ASC
    `;

    let grossSavedUsd = 0;
    const byLayer: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let savedTokens = 0;
    for (const r of rows) {
      const usd = Number(r.saved_usd) || 0;
      grossSavedUsd += usd;
      savedTokens += Number(r.saved_tokens) || 0;
      byLayer[r.layer] = round2((byLayer[r.layer] || 0) + usd);
      byModel[r.model] = round2((byModel[r.model] || 0) + usd);
      const day = new Date(r.ts).toISOString().slice(0, 10);
      byDay[day] = round2((byDay[day] || 0) + usd);
    }
    grossSavedUsd = round2(grossSavedUsd);

    const monthly = url.searchParams.get('planCostUsd');
    const monthlyPlanCost = monthly != null ? Number(monthly) : (PLAN_COST_USD[keyContext.planTier] ?? 0);
    const planCostUsd = round2(monthlyPlanCost * (days / 30));

    const netSavedUsd = round2(grossSavedUsd - planCostUsd);
    const roi = planCostUsd > 0 ? round2(grossSavedUsd / planCostUsd) : null;

    // Daily series (dense) for anomaly detection + sparkline in the console.
    const series: Array<{ date: string; savedUsd: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      series.push({ date: d, savedUsd: byDay[d] || 0 });
    }

    return json({
      organizationSlug: keyContext.organizationSlug,
      windowDays: days,
      hits: rows.length,
      savedTokens,
      grossSavedUsd,
      planCostUsd,
      netSavedUsd,
      roi, // e.g. 76 => $76 saved per $1 of plan
      byLayer,
      byModel,
      series,
      pricedShare: rows.length ? round2(rows.filter((r) => Number(r.saved_usd) > 0).length / rows.length) : 0,
    });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
