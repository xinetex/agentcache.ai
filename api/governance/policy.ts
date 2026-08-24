// api/governance/policy.ts
//
// GET  /api/governance/policy   -> the org's current governance policy
// POST /api/governance/policy   -> set budget / quota / kill-switch / anomaly
//   Headers: Authorization: Bearer ac_...
//   Body (POST, all optional): { budgetUsd, quotaRequests, warnRatio,
//                                killSwitch, blockOnAnomaly, anomalySigma }
//
// The control surface for the reposition: this is where a customer sets the
// guardrails the gate then enforces. Auth + tenant scoping mirror
// api/cache/get.ts (ac_ key -> neon organization).

import { neon } from '@neondatabase/serverless';
import { validateApiKey } from '../../lib/api-key-middleware.js';

export const config = { runtime: 'nodejs' };
import { ensureGovernanceSchema } from '../../lib/ensure-schema.js';
const sql = neon(process.env.DATABASE_URL!);
ensureGovernanceSchema(sql).catch(() => {}); // self-provision on cold start

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' },
  });
}

const DEFAULT_POLICY = {
  budgetUsd: 0, quotaRequests: 0, warnRatio: 0.8,
  killSwitch: false, blockOnAnomaly: false, anomalySigma: 3,
};

function rowToPolicy(r: any) {
  if (!r) return { ...DEFAULT_POLICY, configured: false };
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

async function authOrThrow(req: Request) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  if (!apiKey || !apiKey.startsWith('ac_')) throw { status: 401, message: 'Valid AgentCache API key required' };
  return validateApiKey(apiKey);
}

export default async function handler(req: Request) {
  try {
    let keyContext: any;
    try {
      keyContext = await authOrThrow(req);
    } catch (e: any) {
      return json({ error: 'Unauthorized', message: e?.message || 'auth failed' }, 401);
    }
    const orgId = keyContext.organizationId;

    if (req.method === 'GET') {
      const rows: any[] = await sql`SELECT * FROM governance_policies WHERE organization_id = ${orgId} LIMIT 1`;
      return json({ organizationSlug: keyContext.organizationSlug, policy: rowToPolicy(rows[0]) });
    }

    if (req.method === 'POST') {
      const body: any = (await req.json().catch(() => ({}))) || {};
      const num = (v: any, d: number) => (v == null || Number.isNaN(Number(v)) ? d : Number(v));
      const bool = (v: any, d: boolean) => (typeof v === 'boolean' ? v : d);

      // Load existing to allow partial updates.
      const cur = rowToPolicy((await sql`SELECT * FROM governance_policies WHERE organization_id = ${orgId} LIMIT 1`)[0]);
      const next = {
        budgetUsd: Math.max(0, num(body.budgetUsd, cur.budgetUsd)),
        quotaRequests: Math.max(0, Math.floor(num(body.quotaRequests, cur.quotaRequests))),
        warnRatio: Math.min(1, Math.max(0, num(body.warnRatio, cur.warnRatio))),
        killSwitch: bool(body.killSwitch, cur.killSwitch),
        blockOnAnomaly: bool(body.blockOnAnomaly, cur.blockOnAnomaly),
        anomalySigma: Math.max(0.5, num(body.anomalySigma, cur.anomalySigma)),
      };

      await sql`
        INSERT INTO governance_policies
          (organization_id, budget_usd, quota_requests, warn_ratio, kill_switch, block_on_anomaly, anomaly_sigma, updated_at)
        VALUES
          (${orgId}, ${next.budgetUsd}, ${next.quotaRequests}, ${next.warnRatio},
           ${next.killSwitch}, ${next.blockOnAnomaly}, ${next.anomalySigma}, NOW())
        ON CONFLICT (organization_id) DO UPDATE SET
          budget_usd = EXCLUDED.budget_usd,
          quota_requests = EXCLUDED.quota_requests,
          warn_ratio = EXCLUDED.warn_ratio,
          kill_switch = EXCLUDED.kill_switch,
          block_on_anomaly = EXCLUDED.block_on_anomaly,
          anomaly_sigma = EXCLUDED.anomaly_sigma,
          updated_at = NOW()
      `;
      return json({ organizationSlug: keyContext.organizationSlug, policy: { ...next, configured: true }, saved: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
