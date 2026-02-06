-- Migration 014: Needs Evaluation Pipeline
-- Adds evaluation columns to needs_signals for the 5-stage triage algorithm.

ALTER TABLE needs_signals
  ADD COLUMN IF NOT EXISTS specificity_score REAL,
  ADD COLUMN IF NOT EXISTS evaluation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS clarification_questions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS build_spec JSONB,
  ADD COLUMN IF NOT EXISTS cluster_id TEXT,
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_rank TEXT,
  ADD COLUMN IF NOT EXISTS route TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMP;

-- Index for triage queries
CREATE INDEX IF NOT EXISTS needs_eval_status_idx ON needs_signals(evaluation_status);
CREATE INDEX IF NOT EXISTS needs_priority_idx ON needs_signals(priority_score DESC);
CREATE INDEX IF NOT EXISTS needs_cluster_idx ON needs_signals(cluster_id);
