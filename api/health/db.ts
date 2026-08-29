// api/health/db.ts
//
// GET /api/health/db  — unauthenticated liveness probe for the control-plane
// database. Proves whether Vercel can actually reach Neon (and how fast),
// and whether the control-plane tables are provisioned — WITHOUT needing an
// API key. Also exercises the bounded neon client (lib/neon.js): a dead or
// suspended DB returns a fast { db: "unreachable" } instead of hanging.
//
// Safe to expose: it runs only SELECT 1 + to_regclass() existence checks; it
// returns no row data and no tenant information.

import { sql, withTimeout } from '../../lib/neon.js';

export const config = { runtime: 'nodejs' };

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function handler(_req: Request) {
  const t0 = Date.now();
  try {
    const ping: any[] = await withTimeout(sql`SELECT 1 AS ok`, 7000);
    const reg: any[] = await withTimeout(
      sql`SELECT
            to_regclass('public.savings_events')             AS savings_events,
            to_regclass('public.governance_policies')        AS governance_policies,
            to_regclass('public.organization_usage_metrics') AS usage_metrics`,
      7000,
      [{}]
    );
    const r = reg?.[0] || {};
    return json({
      db: 'ok',
      ping: ping?.[0]?.ok ?? null,
      tables: {
        savings_events: !!r.savings_events,
        governance_policies: !!r.governance_policies,
        organization_usage_metrics: !!r.usage_metrics,
      },
      ms: Date.now() - t0,
    });
  } catch (e: any) {
    // Reachability failure (timeout / DNS / auth) — reported, never thrown.
    return json({ db: 'unreachable', error: e?.message || String(e), ms: Date.now() - t0 }, 200);
  }
}

export { handler as GET };
