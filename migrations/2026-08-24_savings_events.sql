-- migrations/2026-08-24_savings_events.sql
-- Move 1: the immutable per-hit savings ledger.
-- Captures model + layer + saved tokens + saved dollars for every cache hit,
-- so "net dollars saved" is auditable per model/layer instead of a daily blob.

CREATE TABLE IF NOT EXISTS savings_events (
  id              BIGSERIAL PRIMARY KEY,
  organization_id UUID        NOT NULL,
  namespace       TEXT        NOT NULL,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  layer           TEXT        NOT NULL,   -- exact | semantic | prefix | reasoning
  model           TEXT        NOT NULL,   -- 'unknown' when the caller did not declare one
  saved_tokens    INTEGER     NOT NULL DEFAULT 0,
  saved_usd       NUMERIC(14,6) NOT NULL DEFAULT 0,
  session_id      TEXT,
  agent_id        TEXT
);

-- Aggregation reads are always org + time-window scoped.
CREATE INDEX IF NOT EXISTS idx_savings_events_org_ts
  ON savings_events (organization_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_savings_events_org_model
  ON savings_events (organization_id, model);
