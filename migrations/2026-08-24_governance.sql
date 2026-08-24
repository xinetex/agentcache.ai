-- migrations/2026-08-24_governance.sql
-- Move 2: the governance control plane. One policy row per organization.
-- Budget/quota of 0 means "unset" (ungoverned on that dimension) — the gate
-- fails SAFE (allows) on anything a customer never configured.

CREATE TABLE IF NOT EXISTS governance_policies (
  organization_id  UUID PRIMARY KEY,
  budget_usd       NUMERIC(14,2) NOT NULL DEFAULT 0,   -- monthly ceiling; 0 = unset
  quota_requests   BIGINT        NOT NULL DEFAULT 0,   -- monthly request cap; 0 = unset
  warn_ratio       NUMERIC(4,3)  NOT NULL DEFAULT 0.800,
  kill_switch      BOOLEAN       NOT NULL DEFAULT false,
  block_on_anomaly BOOLEAN       NOT NULL DEFAULT false,
  anomaly_sigma    NUMERIC(5,2)  NOT NULL DEFAULT 3.00,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
