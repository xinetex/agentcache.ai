// lib/governance-data.js
//
// Thin data access shared by the governance endpoints. Pulls the org's
// current-month spend, request volume, and daily spend series from the
// existing organization_usage_metrics aggregate, and its policy row.
//
// Spend is defined from columns the aggregate already carries:
//   spent = Σ(cost_baseline) − Σ(cost_saved)   (actual post-cache model spend)
// This is correct-by-construction and grows more precise as the cost fields are
// populated on the request path (see the miss-cost capture note in the build
// report). Everything degrades to zero rather than throwing.

const DEFAULT_POLICY = {
  budgetUsd: 0, quotaRequests: 0, warnRatio: 0.8,
  killSwitch: false, blockOnAnomaly: false, anomalySigma: 3, configured: false,
};

export function rowToPolicy(r) {
  if (!r) return { ...DEFAULT_POLICY };
  return {
    budgetUsd: Number(r.budget_usd),
    quotaRequests: Number(r.quota_requests),
    warnRatio: Number(r.warn_ratio),
    killSwitch: r.kill_switch === true,
    blockOnAnomaly: r.block_on_anomaly === true,
    anomalySigma: Number(r.anomaly_sigma),
    updatedAt: r.updated_at,
    configured: true,
  };
}

export async function loadPolicy(sql, orgId) {
  try {
    const rows = await sql`SELECT * FROM governance_policies WHERE organization_id = ${orgId} LIMIT 1`;
    return rowToPolicy(rows[0]);
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

export async function loadUsage(sql, orgId, days = 30) {
  const empty = { spentUsd: 0, usedRequests: 0, savedUsd: 0, series: [] };
  try {
    const rows = await sql`
      SELECT date,
             SUM(cache_requests)                     AS requests,
             SUM(COALESCE(cost_baseline,0))          AS baseline,
             SUM(COALESCE(cost_saved,0))             AS saved
      FROM organization_usage_metrics
      WHERE organization_id = ${orgId}
        AND date >= CURRENT_DATE - (${days} || ' days')::interval
      GROUP BY date
      ORDER BY date ASC
    `;
    let spentUsd = 0, usedRequests = 0, savedUsd = 0;
    const byDay = {};
    for (const r of rows) {
      const spend = Math.max(0, Number(r.baseline) - Number(r.saved));
      spentUsd += spend;
      usedRequests += Number(r.requests) || 0;
      savedUsd += Number(r.saved) || 0;
      byDay[new Date(r.date).toISOString().slice(0, 10)] = spend;
    }
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      series.push(byDay[d] || 0);
    }
    return { spentUsd: round2(spentUsd), usedRequests, savedUsd: round2(savedUsd), series };
  } catch {
    return empty;
  }
}

function round2(n) { return Math.round(n * 100) / 100; }
