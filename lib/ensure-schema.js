// lib/ensure-schema.js
//
// Self-provisioning schema for the control-plane tables. Serverless functions
// on Vercel can reach Neon directly, so rather than depend on a manual
// migration step, each cold start ensures its tables exist (idempotent
// CREATE TABLE IF NOT EXISTS). Memoized per process so it runs once per warm
// instance; FAILS OPEN so a provisioning hiccup never breaks the request path.
//
// This is why the control plane comes online the moment the code deploys — no
// out-of-band SQL required. The canonical DDL still lives in migrations/ for
// anyone who prefers to run it explicitly.

let _savings = null;
let _governance = null;

export async function ensureSavingsSchema(sql) {
  if (_savings) return _savings;
  _savings = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS savings_events (
        id              BIGSERIAL PRIMARY KEY,
        organization_id TEXT        NOT NULL,
        namespace       TEXT        NOT NULL,
        ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        layer           TEXT        NOT NULL,
        model           TEXT        NOT NULL,
        saved_tokens    INTEGER     NOT NULL DEFAULT 0,
        saved_usd       NUMERIC(14,6) NOT NULL DEFAULT 0,
        session_id      TEXT,
        agent_id        TEXT
      )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_savings_events_org_ts ON savings_events (organization_id, ts DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_savings_events_org_model ON savings_events (organization_id, model)`;
    return true;
  })().catch((e) => {
    console.error('ensureSavingsSchema failed (will retry next call):', e && e.message ? e.message : e);
    _savings = null; // allow retry on a later request
    return false;
  });
  return _savings;
}

export async function ensureGovernanceSchema(sql) {
  if (_governance) return _governance;
  _governance = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS governance_policies (
        organization_id  TEXT PRIMARY KEY,
        budget_usd       NUMERIC(14,2) NOT NULL DEFAULT 0,
        quota_requests   BIGINT        NOT NULL DEFAULT 0,
        warn_ratio       NUMERIC(4,3)  NOT NULL DEFAULT 0.800,
        kill_switch      BOOLEAN       NOT NULL DEFAULT false,
        block_on_anomaly BOOLEAN       NOT NULL DEFAULT false,
        anomaly_sigma    NUMERIC(5,2)  NOT NULL DEFAULT 3.00,
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )`;
    return true;
  })().catch((e) => {
    console.error('ensureGovernanceSchema failed (will retry next call):', e && e.message ? e.message : e);
    _governance = null;
    return false;
  });
  return _governance;
}

// Test-only: reset memoization between cases.
export function _resetSchemaCache() { _savings = null; _governance = null; }

export default { ensureSavingsSchema, ensureGovernanceSchema, _resetSchemaCache };
