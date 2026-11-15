import { validateApiKey } from '../../lib/api-key-middleware.js';
import { decide, round6 } from '../../lib/governance.js';
import { loadPolicy, loadUsage } from '../../lib/governance-data.js';
import { getPrice } from '../../lib/savings.js';
import { ensureGovernanceSchema } from '../../lib/ensure-schema.js';
import { sql } from '../../lib/neon.js';

export async function governanceGate(c: any) {
  c.header('Cache-Control', 'no-store');
  const authHeader = c.req.header('Authorization') || c.req.header('X-API-Key');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return c.json({ error: 'Unauthorized', message: 'Valid AgentCache API key required' }, 401);
  }

  let keyContext: any;
  try {
    keyContext = await validateApiKey(apiKey);
  } catch (error: any) {
    return c.json({ error: 'Unauthorized', message: error?.message || 'Invalid API key' }, 401);
  }

  const body: any = await c.req.json().catch(() => ({}));
  const model = typeof body?.model === 'string' ? body.model : 'unknown';
  const inputTokens = Math.max(0, Number(body?.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(body?.outputTokens) || 0);

  try {
    await ensureGovernanceSchema(sql).catch(() => false);
    const [policy, usage] = await Promise.all([
      loadPolicy(sql, keyContext.organizationId),
      loadUsage(sql, keyContext.organizationId, 30),
    ]);
    const price = getPrice(model);
    const priced = Boolean(price);
    const decisionCostUsd = priced
      ? inputTokens * (price.in / 1_000_000) + outputTokens * (price.out / 1_000_000)
      : 0;
    const estCostUsd = round6(decisionCostUsd);
    const verdict = decide(policy, {
      spentUsd: usage.spentUsd,
      usedRequests: usage.usedRequests,
      estCostUsd: decisionCostUsd,
      series: usage.series,
    });

    return c.json({
      organizationSlug: keyContext.organizationSlug,
      model,
      estCostUsd,
      priced,
      allow: verdict.allow,
      severity: verdict.severity,
      reasons: verdict.reasons,
      budget: verdict.budget,
      quota: verdict.quota,
      anomaly: verdict.anomaly,
    });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Governance evaluation failed' }, 500);
  }
}
