-- migrations/2026-08-25_agent_runs.sql
--
-- Background Agent Runs & Durable Checkpoints Ledger.
--
-- Records background agent executions, live statuses, governance decisions,
-- and durable checkpoints for long-running workflows.

CREATE TABLE IF NOT EXISTS background_agent_runs (
  run_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'default',
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  spent_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
  saved_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
  steps_executed INTEGER NOT NULL DEFAULT 0,
  checkpoint_state JSONB DEFAULT '{}'::jsonb,
  reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_org_created
  ON background_agent_runs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status
  ON background_agent_runs (status);
