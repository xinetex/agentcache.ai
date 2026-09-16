// lib/run-store.js
//
// AgentCache — Durable run state + the org-wide governance context.
//
// Two problems, one module, because they are the same problem: the run loop had
// no memory outside Inngest's own step cache.
//
//  1. PERSISTENCE. The Inngest function computed spend, savings and checkpoints
//     and then threw them away — nothing ever wrote background_agent_runs. So
//     GET /api/agent/run/:id answered with a hard-coded {status:'running'} for
//     every run ever dispatched, including finished and killed ones, and there
//     was no row for authorization to check ownership against either.
//
//  2. ORG-WIDE GATING. planStep() was handed `spentUsd: run.spentUsd` — the
//     spend of THIS run alone, starting at zero. Ten concurrent runs each
//     believed the org had spent nothing, so an org-level budget could be
//     overrun N times over. The product promise is "your agent burned $4k
//     overnight; here's the firewall": a per-run-only gate does not keep it.
//     loadGovernanceContext() folds the org's real month-to-date spend, request
//     volume and daily series (already computed by governance-data.js) into the
//     verdict, and mergeRunContext() adds what this run has spent since.
//
// Persistence FAILS OPEN (an agent must not die because telemetry hiccuped).
// Authorization reads the same table and FAILS CLOSED — see lib/run-authz.js.

import { loadPolicy, loadUsage } from './governance-data.js';
import { round2 } from './savings.js';

// --- Governance context ---------------------------------------------------

/** Loads the org's policy + real spend posture. Degrades to an ungoverned-but-safe zero. */
export async function loadGovernanceContext(sql, organizationId, { days = 30 } = {}) {
  if (typeof sql !== 'function' || !organizationId) {
    return { policy: {}, org: { spentUsd: 0, usedRequests: 0, series: [] } };
  }
  const [policy, usage] = await Promise.all([
    loadPolicy(sql, organizationId).catch(() => ({})),
    loadUsage(sql, organizationId, days).catch(() => ({ spentUsd: 0, usedRequests: 0, series: [] })),
  ]);
  return {
    policy: policy || {},
    org: {
      spentUsd: Number(usage.spentUsd) || 0,
      usedRequests: Number(usage.usedRequests) || 0,
      series: Array.isArray(usage.series) ? usage.series : [],
    },
  };
}

/**
 * PURE. Produce the run object planStep() should gate against: this run's own
 * counters PLUS the org's standing consumption. Without this the gate is
 * per-run and the budget is unenforceable in aggregate.
 */
export function mergeRunContext(run = {}, org = {}) {
  const orgSpent = Number(org.spentUsd) || 0;
  const orgReqs = Number(org.usedRequests) || 0;
  const series = Array.isArray(org.series) ? org.series : [];
  // The org's latest series point must include what this run has already spent,
  // or an in-progress runaway is invisible to anomaly detection until tomorrow.
  const live = series.length
    ? [...series.slice(0, -1), round2((Number(series[series.length - 1]) || 0) + (run.spentUsd || 0))]
    : series;
  return {
    ...run,
    spentUsd: round2(orgSpent + (run.spentUsd || 0)),
    stepsExecuted: orgReqs + (run.stepsExecuted || 0),
    series: live,
    _runSpentUsd: run.spentUsd || 0, // preserved so persistence records the RUN's own spend
  };
}

// --- Durable run rows -----------------------------------------------------

export async function ensureAgentRunSchema(sql) {
  if (typeof sql !== 'function') return false;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS background_agent_runs (
        run_id           TEXT PRIMARY KEY,
        organization_id  TEXT NOT NULL,
        agent_id         TEXT NOT NULL,
        namespace        TEXT NOT NULL DEFAULT 'default',
        goal             TEXT,
        status           TEXT NOT NULL DEFAULT 'running',
        spent_usd        NUMERIC(14,4) NOT NULL DEFAULT 0,
        saved_usd        NUMERIC(14,4) NOT NULL DEFAULT 0,
        steps_executed   INTEGER NOT NULL DEFAULT 0,
        checkpoint_state JSONB DEFAULT '{}'::jsonb,
        reasons          TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at     TIMESTAMPTZ
      )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_agent_runs_org_created ON background_agent_runs (organization_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON background_agent_runs (status)`;
    return true;
  } catch (err) {
    console.error('ensureAgentRunSchema failed (non-fatal):', err && err.message ? err.message : err);
    return false;
  }
}

const TERMINAL = new Set(['completed', 'killed', 'blocked']);

/** PURE. Normalize a run + checkpoint into the row we persist. */
export function runToRow(run = {}, extra = {}) {
  const status = String(run.status || 'running');
  return {
    runId: run.runId,
    organizationId: extra.organizationId || run.organizationId || null,
    agentId: run.agentId || 'default',
    namespace: run.namespace || 'default',
    goal: run.goal || '',
    status,
    spentUsd: round2(run._runSpentUsd ?? run.spentUsd ?? 0),
    savedUsd: round2(run.savedUsd || 0),
    stepsExecuted: Number(run.stepsExecuted) || 0,
    reasons: Array.isArray(extra.reasons) ? extra.reasons.map(String) : [],
    terminal: TERMINAL.has(status),
  };
}

/**
 * Upsert the run's current state. deps = { sql }. Never throws.
 * The insert at dispatch and every checkpoint go through here, so ownership is
 * recorded before the first step can ever be approved by anyone.
 */
export async function persistRun(deps, run, extra = {}) {
  const { sql } = deps || {};
  try {
    if (typeof sql !== 'function') return null;
    const r = runToRow(run, extra);
    if (!r.runId || !r.organizationId) return null;
    const checkpoint = JSON.stringify(extra.checkpoint || {});
    await sql`
      INSERT INTO background_agent_runs
        (run_id, organization_id, agent_id, namespace, goal, status,
         spent_usd, saved_usd, steps_executed, checkpoint_state, reasons, updated_at, completed_at)
      VALUES
        (${r.runId}, ${r.organizationId}, ${r.agentId}, ${r.namespace}, ${r.goal}, ${r.status},
         ${r.spentUsd}, ${r.savedUsd}, ${r.stepsExecuted}, ${checkpoint}::jsonb, ${r.reasons}, NOW(),
         ${r.terminal ? new Date().toISOString() : null})
      ON CONFLICT (run_id) DO UPDATE SET
        status           = EXCLUDED.status,
        spent_usd        = EXCLUDED.spent_usd,
        saved_usd        = EXCLUDED.saved_usd,
        steps_executed   = EXCLUDED.steps_executed,
        checkpoint_state = EXCLUDED.checkpoint_state,
        reasons          = EXCLUDED.reasons,
        updated_at       = NOW(),
        completed_at     = COALESCE(background_agent_runs.completed_at, EXCLUDED.completed_at)
    `;
    return r;
  } catch (err) {
    console.error('persistRun failed (non-fatal):', err && err.message ? err.message : err);
    return null;
  }
}

export default {
  loadGovernanceContext, mergeRunContext, ensureAgentRunSchema, runToRow, persistRun,
};
