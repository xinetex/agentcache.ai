-- Cognitive Universe Schema Extension
-- Adds tables for latent space tracking, cross-sector intelligence, and cognitive operations

-- 1. Latent Space Embeddings Table
-- Tracks T5 autoencoder embeddings for visualization
CREATE TABLE IF NOT EXISTS latent_space_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  
  -- Query context
  query_text TEXT NOT NULL,
  sector TEXT NOT NULL,
  
  -- Latent space coordinates (2D projection for visualization)
  embedding_x DECIMAL(10,4) NOT NULL,
  embedding_y DECIMAL(10,4) NOT NULL,
  
  -- Full embedding vector (768 dimensions for T5-small)
  embedding_vector VECTOR(768), -- Requires pgvector extension
  
  -- Performance metrics
  latency_ms INTEGER NOT NULL,
  cache_tier TEXT, -- 'L1', 'L2', 'L3', 'latent', 'llm'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_sector CHECK (sector IN (
    'healthcare', 'finance', 'legal', 'education', 'ecommerce',
    'enterprise', 'developer', 'datascience', 'government', 'general'
  )),
  CONSTRAINT valid_cache_tier CHECK (cache_tier IN ('L1', 'L2', 'L3', 'latent', 'llm'))
);

CREATE INDEX idx_latent_sector ON latent_space_embeddings(sector);
CREATE INDEX idx_latent_created ON latent_space_embeddings(created_at DESC);
CREATE INDEX idx_latent_coordinates ON latent_space_embeddings(embedding_x, embedding_y);
CREATE INDEX idx_latent_user ON latent_space_embeddings(user_id);

-- 2. Cross-Sector Intelligence Table
-- Tracks knowledge transfer between sectors
CREATE TABLE IF NOT EXISTS cross_sector_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source and target sectors
  source_sector TEXT NOT NULL,
  target_sector TEXT NOT NULL,
  
  -- Intelligence details
  insight_type TEXT NOT NULL, -- 'pattern_transfer', 'compliance_sharing', 'optimization'
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  
  -- Impact metrics
  queries_influenced INTEGER DEFAULT 0,
  latency_improvement_ms INTEGER DEFAULT 0,
  cost_savings DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_applied_at TIMESTAMP,
  
  CONSTRAINT valid_source_sector CHECK (source_sector IN (
    'healthcare', 'finance', 'legal', 'education', 'ecommerce',
    'enterprise', 'developer', 'datascience', 'government', 'general'
  )),
  CONSTRAINT valid_target_sector CHECK (target_sector IN (
    'healthcare', 'finance', 'legal', 'education', 'ecommerce',
    'enterprise', 'developer', 'datascience', 'government', 'general'
  )),
  CONSTRAINT valid_insight_type CHECK (insight_type IN (
    'pattern_transfer', 'compliance_sharing', 'optimization', 'security_learning'
  ))
);

CREATE INDEX idx_cross_sector_source ON cross_sector_intelligence(source_sector);
CREATE INDEX idx_cross_sector_target ON cross_sector_intelligence(target_sector);
CREATE INDEX idx_cross_sector_created ON cross_sector_intelligence(created_at DESC);
CREATE INDEX idx_cross_sector_confidence ON cross_sector_intelligence(confidence_score DESC);

-- 3. Cognitive Operations Log
-- Real-time tracking of cognitive layer operations
CREATE TABLE IF NOT EXISTS cognitive_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  
  -- Operation details
  operation_type TEXT NOT NULL, -- 'validation', 'threat_detection', 'memory_optimization'
  operation_category TEXT NOT NULL, -- 'validation_pipeline', 'threat_detection', 'memory_ops'
  
  -- Query context
  query_hash TEXT, -- SHA256 hash for privacy
  sector TEXT NOT NULL,
  
  -- Results
  status TEXT NOT NULL, -- 'success', 'blocked', 'warning'
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  
  -- Performance
  latency_ms INTEGER DEFAULT 0,
  
  -- Details
  details JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_operation_type CHECK (operation_type IN (
    'validation', 'threat_detection', 'memory_optimization',
    'hallucination_prevention', 'injection_block', 'cache_promotion',
    'cache_demotion', 'conflict_resolution'
  )),
  CONSTRAINT valid_operation_category CHECK (operation_category IN (
    'validation_pipeline', 'threat_detection', 'memory_ops'
  )),
  CONSTRAINT valid_sector CHECK (sector IN (
    'healthcare', 'finance', 'legal', 'education', 'ecommerce',
    'enterprise', 'developer', 'datascience', 'government', 'general'
  )),
  CONSTRAINT valid_status CHECK (status IN ('success', 'blocked', 'warning', 'error'))
);

CREATE INDEX idx_cognitive_ops_type ON cognitive_operations(operation_type);
CREATE INDEX idx_cognitive_ops_category ON cognitive_operations(operation_category);
CREATE INDEX idx_cognitive_ops_sector ON cognitive_operations(sector);
CREATE INDEX idx_cognitive_ops_created ON cognitive_operations(created_at DESC);
CREATE INDEX idx_cognitive_ops_user ON cognitive_operations(user_id);
CREATE INDEX idx_cognitive_ops_status ON cognitive_operations(status);

-- 4. Real-Time Cognitive Metrics (Aggregated)
-- Pre-computed metrics for fast dashboard loading
CREATE TABLE IF NOT EXISTS cognitive_metrics_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time bucket
  snapshot_time TIMESTAMP NOT NULL,
  time_bucket TEXT NOT NULL, -- '1h', '24h', '7d', '30d'
  
  -- Overall metrics
  total_cache_hits BIGINT DEFAULT 0,
  cognitive_accuracy DECIMAL(5,2) DEFAULT 0,
  latent_usage_pct DECIMAL(5,2) DEFAULT 0,
  cost_savings DECIMAL(10,2) DEFAULT 0,
  cross_sector_insights INTEGER DEFAULT 0,
  hallucinations_prevented INTEGER DEFAULT 0,
  security_blocks INTEGER DEFAULT 0,
  memory_efficiency DECIMAL(5,2) DEFAULT 0,
  
  -- Cognitive operations breakdown
  validation_count INTEGER DEFAULT 0,
  threat_count INTEGER DEFAULT 0,
  memory_ops_count BIGINT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_time_bucket CHECK (time_bucket IN ('1h', '24h', '7d', '30d')),
  UNIQUE (snapshot_time, time_bucket)
);

CREATE INDEX idx_metrics_snapshot_time ON cognitive_metrics_snapshot(snapshot_time DESC);
CREATE INDEX idx_metrics_bucket ON cognitive_metrics_snapshot(time_bucket);

-- 5. Query Flow Analytics
-- Tracks query lifecycle through cache hierarchy
CREATE TABLE IF NOT EXISTS query_flow_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Query context
  query_hash TEXT NOT NULL,
  sector TEXT NOT NULL,
  
  -- Flow path
  entered_cognitive_layer_at TIMESTAMP NOT NULL,
  cache_decision TEXT NOT NULL, -- 'L1', 'L2', 'L3', 'latent', 'llm'
  responded_at TIMESTAMP NOT NULL,
  
  -- Performance
  total_latency_ms INTEGER NOT NULL,
  cache_lookup_ms INTEGER DEFAULT 0,
  latent_processing_ms INTEGER DEFAULT 0,
  llm_processing_ms INTEGER DEFAULT 0,
  
  -- Cost
  cost_usd DECIMAL(10,6) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_sector CHECK (sector IN (
    'healthcare', 'finance', 'legal', 'education', 'ecommerce',
    'enterprise', 'developer', 'datascience', 'government', 'general'
  )),
  CONSTRAINT valid_cache_decision CHECK (cache_decision IN ('L1', 'L2', 'L3', 'latent', 'llm'))
);

CREATE INDEX idx_query_flow_created ON query_flow_analytics(created_at DESC);
CREATE INDEX idx_query_flow_sector ON query_flow_analytics(sector);
CREATE INDEX idx_query_flow_decision ON query_flow_analytics(cache_decision);
CREATE INDEX idx_query_flow_user ON query_flow_analytics(user_id);

-- 6. Views for Common Queries

-- Real-time cognitive metrics view (last 24 hours)
CREATE OR REPLACE VIEW cognitive_metrics_realtime AS
SELECT
  COUNT(*) FILTER (WHERE qf.cache_decision IN ('L1', 'L2', 'L3')) as total_cache_hits,
  ROUND(AVG(CASE 
    WHEN co.operation_type = 'validation' AND co.confidence_score >= 0.8 
    THEN 100.0 
    ELSE 0 
  END), 2) as cognitive_accuracy,
  ROUND(100.0 * COUNT(*) FILTER (WHERE qf.cache_decision = 'latent') / NULLIF(COUNT(*), 0), 2) as latent_usage_pct,
  ROUND(SUM(qf.cost_usd), 2) as cost_savings,
  (SELECT COUNT(*) FROM cross_sector_intelligence WHERE created_at >= NOW() - INTERVAL '24 hours') as cross_sector_insights,
  COUNT(*) FILTER (WHERE co.operation_type = 'hallucination_prevention') as hallucinations_prevented,
  COUNT(*) FILTER (WHERE co.operation_type = 'injection_block') as security_blocks,
  ROUND(100.0 * COUNT(*) FILTER (WHERE qf.cache_decision IN ('L2', 'L3')) / NULLIF(COUNT(*), 0), 2) as memory_efficiency
FROM query_flow_analytics qf
LEFT JOIN cognitive_operations co ON co.created_at >= NOW() - INTERVAL '24 hours'
WHERE qf.created_at >= NOW() - INTERVAL '24 hours';

-- Sector metrics view
CREATE OR REPLACE VIEW sector_metrics_summary AS
SELECT
  qf.sector,
  COUNT(*) as total_queries,
  COUNT(*) FILTER (WHERE qf.cache_decision IN ('L1', 'L2', 'L3')) as cache_hits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE qf.cache_decision IN ('L1', 'L2', 'L3')) / NULLIF(COUNT(*), 0), 1) as hit_rate,
  ROUND(AVG(qf.total_latency_ms), 0) as avg_latency_ms,
  COUNT(DISTINCT co.id) FILTER (WHERE co.operation_type = 'validation') as validations,
  COUNT(DISTINCT co.id) FILTER (WHERE co.status = 'blocked') as security_blocks
FROM query_flow_analytics qf
LEFT JOIN cognitive_operations co ON co.sector = qf.sector AND co.created_at >= NOW() - INTERVAL '24 hours'
WHERE qf.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY qf.sector;

-- Cross-sector intelligence flows view
CREATE OR REPLACE VIEW cross_sector_flows AS
SELECT
  source_sector,
  target_sector,
  COUNT(*) as flow_count,
  AVG(confidence_score) as avg_confidence,
  SUM(queries_influenced) as total_queries_influenced,
  AVG(latency_improvement_ms) as avg_latency_improvement,
  SUM(cost_savings) as total_cost_savings
FROM cross_sector_intelligence
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY source_sector, target_sector
HAVING COUNT(*) >= 3
ORDER BY flow_count DESC;

-- 7. Functions for Aggregation

-- Function to aggregate cognitive metrics hourly (for cron job)
CREATE OR REPLACE FUNCTION aggregate_cognitive_metrics_hourly()
RETURNS void AS $$
BEGIN
  INSERT INTO cognitive_metrics_snapshot (
    snapshot_time,
    time_bucket,
    total_cache_hits,
    cognitive_accuracy,
    latent_usage_pct,
    cost_savings,
    cross_sector_insights,
    hallucinations_prevented,
    security_blocks,
    memory_efficiency,
    validation_count,
    threat_count,
    memory_ops_count
  )
  SELECT
    DATE_TRUNC('hour', NOW()) as snapshot_time,
    '1h' as time_bucket,
    COUNT(*) FILTER (WHERE qf.cache_decision IN ('L1', 'L2', 'L3')) as total_cache_hits,
    ROUND(AVG(CASE 
      WHEN co.operation_type = 'validation' AND co.confidence_score >= 0.8 
      THEN 100.0 
      ELSE 0 
    END), 2) as cognitive_accuracy,
    ROUND(100.0 * COUNT(*) FILTER (WHERE qf.cache_decision = 'latent') / NULLIF(COUNT(*), 0), 2) as latent_usage_pct,
    ROUND(SUM(qf.cost_usd), 2) as cost_savings,
    (SELECT COUNT(*) FROM cross_sector_intelligence WHERE created_at >= NOW() - INTERVAL '1 hour') as cross_sector_insights,
    COUNT(*) FILTER (WHERE co.operation_type = 'hallucination_prevention') as hallucinations_prevented,
    COUNT(*) FILTER (WHERE co.operation_type = 'injection_block') as security_blocks,
    ROUND(100.0 * COUNT(*) FILTER (WHERE qf.cache_decision IN ('L2', 'L3')) / NULLIF(COUNT(*), 0), 2) as memory_efficiency,
    COUNT(*) FILTER (WHERE co.operation_category = 'validation_pipeline') as validation_count,
    COUNT(*) FILTER (WHERE co.operation_category = 'threat_detection') as threat_count,
    COUNT(*) FILTER (WHERE co.operation_category = 'memory_ops') as memory_ops_count
  FROM query_flow_analytics qf
  LEFT JOIN cognitive_operations co ON co.created_at >= NOW() - INTERVAL '1 hour'
  WHERE qf.created_at >= NOW() - INTERVAL '1 hour'
  ON CONFLICT (snapshot_time, time_bucket) DO UPDATE SET
    total_cache_hits = EXCLUDED.total_cache_hits,
    cognitive_accuracy = EXCLUDED.cognitive_accuracy,
    latent_usage_pct = EXCLUDED.latent_usage_pct,
    cost_savings = EXCLUDED.cost_savings,
    cross_sector_insights = EXCLUDED.cross_sector_insights,
    hallucinations_prevented = EXCLUDED.hallucinations_prevented,
    security_blocks = EXCLUDED.security_blocks,
    memory_efficiency = EXCLUDED.memory_efficiency,
    validation_count = EXCLUDED.validation_count,
    threat_count = EXCLUDED.threat_count,
    memory_ops_count = EXCLUDED.memory_ops_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Seed some initial data for testing (optional)
-- Uncomment for development/testing only

/*
INSERT INTO latent_space_embeddings (user_id, query_text, sector, embedding_x, embedding_y, latency_ms, cache_tier)
VALUES 
  (NULL, 'Healthcare EHR query', 'healthcare', 450.23, 230.45, 485, 'latent'),
  (NULL, 'Financial trading analysis', 'finance', 520.67, 180.34, 512, 'latent'),
  (NULL, 'Legal case precedent search', 'legal', 380.91, 290.12, 534, 'L2');

INSERT INTO cross_sector_intelligence (source_sector, target_sector, insight_type, confidence_score, queries_influenced)
VALUES
  ('healthcare', 'finance', 'compliance_sharing', 0.92, 12),
  ('finance', 'legal', 'pattern_transfer', 0.88, 15),
  ('developer', 'datascience', 'optimization', 0.95, 11);

INSERT INTO cognitive_operations (user_id, operation_type, operation_category, sector, status, confidence_score, latency_ms)
VALUES
  (NULL, 'validation', 'validation_pipeline', 'healthcare', 'success', 0.94, 45),
  (NULL, 'hallucination_prevention', 'validation_pipeline', 'finance', 'blocked', 0.45, 32),
  (NULL, 'injection_block', 'threat_detection', 'general', 'blocked', 0.98, 18);
*/
