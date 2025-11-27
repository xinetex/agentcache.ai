-- Migration 005: Workspace and Pipeline Infrastructure
-- Created: 2024-11-27
-- Purpose: Add workspace management, pipeline configurations, and sector analytics

-- ============================================================================
-- Tables
-- ============================================================================

-- Workspaces: User workspace metadata
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  sector VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspaces_user ON workspaces(user_id);
CREATE INDEX idx_workspaces_sector ON workspaces(sector);

-- Pipelines table already exists - add missing columns if needed
ALTER TABLE pipelines 
  ADD COLUMN IF NOT EXISTS node_count INTEGER NOT NULL DEFAULT 0;

-- Note: pipelines table already has:
-- - id, user_id, name, description, sector, nodes, connections, features
-- - complexity_tier, complexity_score, monthly_cost, status
-- - stripe_price_id, stripe_subscription_item_id
-- - created_at, updated_at, deployed_at, organization_id
-- All necessary columns exist, no further migration needed

-- Pipeline Metrics: Real-time pipeline performance data
CREATE TABLE IF NOT EXISTS pipeline_metrics (
  id BIGSERIAL PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requests INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  hit_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- percentage
  latency_p50 INTEGER NOT NULL DEFAULT 0, -- milliseconds
  latency_p95 INTEGER NOT NULL DEFAULT 0, -- milliseconds
  cost_saved DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- dollars
  tokens_saved INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_pipeline_metrics_pipeline ON pipeline_metrics(pipeline_id);
CREATE INDEX idx_pipeline_metrics_timestamp ON pipeline_metrics(timestamp DESC);

-- Sector Analytics: Per-sector aggregated metrics
CREATE TABLE IF NOT EXISTS sector_analytics (
  id BIGSERIAL PRIMARY KEY,
  sector VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  avg_latency INTEGER NOT NULL DEFAULT 0, -- milliseconds
  cost_saved DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  top_query_types JSONB NOT NULL DEFAULT '[]', -- array of {type, count, hitRate}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_sector_analytics_unique ON sector_analytics(sector, date);
CREATE INDEX idx_sector_analytics_sector ON sector_analytics(sector);
CREATE INDEX idx_sector_analytics_date ON sector_analytics(date DESC);

-- ============================================================================
-- Views
-- ============================================================================

-- Workspace Summary: Aggregate workspace statistics
CREATE OR REPLACE VIEW workspace_summary AS
SELECT 
  w.id AS workspace_id,
  w.name AS workspace_name,
  w.sector,
  COUNT(p.id) AS total_pipelines,
  COUNT(CASE WHEN p.status = 'active' THEN 1 END) AS active_pipelines,
  SUM(p.monthly_cost) AS total_monthly_cost,
  AVG(p.node_count) AS avg_node_count,
  w.created_at,
  w.updated_at
FROM workspaces w
LEFT JOIN pipelines p ON p.user_id = w.user_id AND p.sector = w.sector
GROUP BY w.id, w.name, w.sector, w.created_at, w.updated_at;

-- Pipeline Performance (24h): Rolling 24-hour metrics per pipeline
CREATE OR REPLACE VIEW pipeline_performance_24h AS
SELECT 
  p.id AS pipeline_id,
  p.name AS pipeline_name,
  p.sector,
  p.status,
  SUM(pm.requests) AS total_requests,
  SUM(pm.cache_hits) AS total_hits,
  SUM(pm.cache_misses) AS total_misses,
  CASE 
    WHEN SUM(pm.requests) > 0 
    THEN ROUND((SUM(pm.cache_hits)::DECIMAL / SUM(pm.requests)) * 100, 2)
    ELSE 0 
  END AS hit_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.latency_p50) AS median_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.latency_p95) AS p95_latency,
  SUM(pm.cost_saved) AS total_cost_saved,
  SUM(pm.tokens_saved) AS total_tokens_saved
FROM pipelines p
LEFT JOIN pipeline_metrics pm ON pm.pipeline_id = p.id 
  AND pm.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY p.id, p.name, p.sector, p.status;

-- Sector Dashboard Metrics: Pre-aggregated data for sector dashboards
CREATE OR REPLACE VIEW sector_dashboard_metrics AS
SELECT 
  p.sector,
  COUNT(DISTINCT p.id) AS total_pipelines,
  COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) AS active_pipelines,
  SUM(pm.requests) AS total_requests_24h,
  CASE 
    WHEN SUM(pm.requests) > 0 
    THEN ROUND((SUM(pm.cache_hits)::DECIMAL / SUM(pm.requests)) * 100, 2)
    ELSE 0 
  END AS hit_rate_24h,
  ROUND(AVG(pm.latency_p50)) AS avg_latency_ms,
  SUM(pm.cost_saved) AS cost_saved_24h,
  SUM(pm.tokens_saved) AS tokens_saved_24h
FROM pipelines p
LEFT JOIN pipeline_metrics pm ON pm.pipeline_id = p.id 
  AND pm.timestamp >= NOW() - INTERVAL '24 hours'
WHERE p.status IN ('active', 'paused')
GROUP BY p.sector;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE workspaces IS 'User workspace metadata for organizing pipelines';
COMMENT ON TABLE pipelines IS 'Pipeline configurations with JSONB node graph storage';
COMMENT ON TABLE pipeline_metrics IS 'Time-series metrics for pipeline performance tracking';
COMMENT ON TABLE sector_analytics IS 'Daily aggregated metrics per sector for analytics';

COMMENT ON VIEW workspace_summary IS 'Aggregated workspace statistics with pipeline counts and costs';
COMMENT ON VIEW pipeline_performance_24h IS 'Rolling 24-hour performance metrics per pipeline';
COMMENT ON VIEW sector_dashboard_metrics IS 'Pre-aggregated sector-level metrics for dashboards';
