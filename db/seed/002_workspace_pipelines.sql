-- Seed Data: Workspaces, Pipelines, and Metrics
-- Created: 2024-11-27
-- Purpose: Populate test data for dashboard and analytics

-- Clear existing data (optional, comment out if you want to preserve data)
-- TRUNCATE TABLE pipeline_metrics, sector_analytics, pipelines, workspaces CASCADE;

-- ============================================================================
-- Workspaces
-- ============================================================================

INSERT INTO workspaces (id, user_id, name, sector, description, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Healthcare Operations', 'healthcare', 'HIPAA-compliant workspace for clinical operations', NOW() - INTERVAL '30 days'),
('550e8400-e29b-41d4-a716-446655440002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Finance Trading Desk', 'finance', 'High-frequency trading and risk analysis', NOW() - INTERVAL '20 days'),
('550e8400-e29b-41d4-a716-446655440003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Legal Document Analysis', 'legal', 'Contract review and privilege protection', NOW() - INTERVAL '15 days'),
('550e8400-e29b-41d4-a716-446655440004'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Developer Tools', 'developer', 'Code generation and documentation', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Pipelines
-- ============================================================================

INSERT INTO pipelines (id, user_id, name, description, sector, nodes, connections, features, complexity_tier, complexity_score, monthly_cost, status, created_at, deployed_at, node_count) VALUES
-- Healthcare Pipelines
('660e8400-e29b-41d4-a716-446655440001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Clinical Decision Support', 'HIPAA-compliant cache for patient triage and diagnosis', 'healthcare', 
  '[{"type":"http_api","id":"api1"},{"type":"cache_l1","id":"l1"},{"type":"cache_l2","id":"l2"},{"type":"hipaa_audit","id":"audit"},{"type":"llm_openai","id":"llm"}]'::jsonb,
  '[{"from":"api1","to":"l1"},{"from":"l1","to":"l2"},{"from":"l2","to":"audit"},{"from":"audit","to":"llm"}]'::jsonb,
  '["hipaa_compliance","audit_logging","phi_protection"]'::jsonb,
  'complex', 85, 420.00, 'active', NOW() - INTERVAL '25 days', NOW() - INTERVAL '20 days', 5),
  
('660e8400-e29b-41d4-a716-446655440002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'EHR Integration Pipeline', 'Epic EHR data caching with real-time sync', 'healthcare',
  '[{"type":"database","id":"epic"},{"type":"cache_l1","id":"l1"},{"type":"llm_openai","id":"llm"}]'::jsonb,
  '[{"from":"epic","to":"l1"},{"from":"l1","to":"llm"}]'::jsonb,
  '["hipaa_compliance","real_time_sync"]'::jsonb,
  'moderate', 65, 280.00, 'active', NOW() - INTERVAL '18 days', NOW() - INTERVAL '15 days', 3),

-- Finance Pipelines
('660e8400-e29b-41d4-a716-446655440003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Trading Risk Analysis', 'Low-latency cache for market data and risk models', 'finance',
  '[{"type":"http_api","id":"api1"},{"type":"cache_l1","id":"l1"},{"type":"market_data","id":"market"},{"type":"llm_openai","id":"llm"}]'::jsonb,
  '[{"from":"api1","to":"l1"},{"from":"l1","to":"market"},{"from":"market","to":"llm"}]'::jsonb,
  '["low_latency","real_time_data","compliance_check"]'::jsonb,
  'complex', 90, 650.00, 'active', NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days', 4),
  
('660e8400-e29b-41d4-a716-446655440004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Fraud Detection', 'Transaction screening with anomaly detection', 'finance',
  '[{"type":"http_api","id":"api1"},{"type":"cache_l2","id":"l2"},{"type":"fraud_check","id":"fraud"},{"type":"llm_openai","id":"llm"}]'::jsonb,
  '[{"from":"api1","to":"l2"},{"from":"l2","to":"fraud"},{"from":"fraud","to":"llm"}]'::jsonb,
  '["fraud_detection","anomaly_detection"]'::jsonb,
  'complex', 88, 580.00, 'active', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days', 4),

-- Legal Pipelines
('660e8400-e29b-41d4-a716-446655440005'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Contract Review Assistant', 'Privilege-protected cache for legal document analysis', 'legal',
  '[{"type":"database","id":"docstore"},{"type":"cache_l1","id":"l1"},{"type":"privilege_check","id":"priv"},{"type":"llm_openai","id":"llm"}]'::jsonb,
  '[{"from":"docstore","to":"l1"},{"from":"l1","to":"priv"},{"from":"priv","to":"llm"}]'::jsonb,
  '["privilege_protection","audit_trail","redaction"]'::jsonb,
  'complex', 82, 490.00, 'active', NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days', 4),

-- Developer Pipelines
('660e8400-e29b-41d4-a716-446655440006'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Code Generation Cache', 'High-performance cache for code completion and generation', 'developer',
  '[{"type":"http_api","id":"api1"},{"type":"cache_l1","id":"l1"},{"type":"llm_openai","id":"llm"}]'::jsonb,
  '[{"from":"api1","to":"l1"},{"from":"l1","to":"llm"}]'::jsonb,
  '["fast_response","code_validation"]'::jsonb,
  'simple', 45, 180.00, 'active', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', 3),

('660e8400-e29b-41d4-a716-446655440007'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Documentation Assistant', 'AI-powered documentation generation pipeline', 'developer',
  '[{"type":"http_api","id":"api1"},{"type":"cache_l2","id":"l2"},{"type":"llm_openai","id":"llm"}]'::jsonb,
  '[{"from":"api1","to":"l2"},{"from":"l2","to":"llm"}]'::jsonb,
  '["batch_processing"]'::jsonb,
  'simple', 40, 150.00, 'active', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days', 3),

-- Draft/Paused Pipelines
('660e8400-e29b-41d4-a716-446655440008'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'E-commerce Recommendations', 'Product recommendation cache (in development)', 'ecommerce',
  '[{"type":"http_api","id":"api1"},{"type":"cache_l1","id":"l1"}]'::jsonb,
  '[{"from":"api1","to":"l1"}]'::jsonb,
  '[]'::jsonb,
  'simple', 30, 120.00, 'draft', NOW() - INTERVAL '3 days', NULL, 2),

('660e8400-e29b-41d4-a716-446655440009'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Government Compliance Check', 'FISMA-compliant pipeline (paused for review)', 'government',
  '[{"type":"http_api","id":"api1"},{"type":"cache_l2","id":"l2"},{"type":"compliance_check","id":"comp"}]'::jsonb,
  '[{"from":"api1","to":"l2"},{"from":"l2","to":"comp"}]'::jsonb,
  '["fisma_compliance"]'::jsonb,
  'moderate', 70, 380.00, 'paused', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days', 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Pipeline Metrics (24 hours of data points)
-- ============================================================================

-- Generate metrics for each active pipeline over the last 24 hours
-- Clinical Decision Support (high performance)
INSERT INTO pipeline_metrics (pipeline_id, timestamp, requests, cache_hits, cache_misses, hit_rate, latency_p50, latency_p95, cost_saved, tokens_saved)
SELECT 
  '660e8400-e29b-41d4-a716-446655440001'::uuid,
  NOW() - (interval '1 hour' * generate_series(0, 23)),
  1500 + floor(random() * 500)::int,
  1370 + floor(random() * 100)::int,
  130 + floor(random() * 50)::int,
  91.3,
  95 + floor(random() * 30)::int,
  180 + floor(random() * 50)::int,
  95.50 + (random() * 15),
  48000 + floor(random() * 5000)::int
FROM generate_series(0, 23);

-- EHR Integration
INSERT INTO pipeline_metrics (pipeline_id, timestamp, requests, cache_hits, cache_misses, hit_rate, latency_p50, latency_p95, cost_saved, tokens_saved)
SELECT 
  '660e8400-e29b-41d4-a716-446655440002'::uuid,
  NOW() - (interval '1 hour' * generate_series(0, 23)),
  800 + floor(random() * 200)::int,
  680 + floor(random() * 80)::int,
  120 + floor(random() * 40)::int,
  85.0,
  110 + floor(random() * 40)::int,
  220 + floor(random() * 60)::int,
  58.20 + (random() * 10),
  29000 + floor(random() * 3000)::int
FROM generate_series(0, 23);

-- Trading Risk Analysis (ultra low latency)
INSERT INTO pipeline_metrics (pipeline_id, timestamp, requests, cache_hits, cache_misses, hit_rate, latency_p50, latency_p95, cost_saved, tokens_saved)
SELECT 
  '660e8400-e29b-41d4-a716-446655440003'::uuid,
  NOW() - (interval '1 hour' * generate_series(0, 23)),
  2200 + floor(random() * 600)::int,
  2050 + floor(random() * 150)::int,
  150 + floor(random() * 60)::int,
  93.2,
  45 + floor(random() * 15)::int,
  90 + floor(random() * 30)::int,
  180.00 + (random() * 30),
  90000 + floor(random() * 10000)::int
FROM generate_series(0, 23);

-- Fraud Detection
INSERT INTO pipeline_metrics (pipeline_id, timestamp, requests, cache_hits, cache_misses, hit_rate, latency_p50, latency_p95, cost_saved, tokens_saved)
SELECT 
  '660e8400-e29b-41d4-a716-446655440004'::uuid,
  NOW() - (interval '1 hour' * generate_series(0, 23)),
  1100 + floor(random() * 300)::int,
  950 + floor(random() * 100)::int,
  150 + floor(random() * 50)::int,
  86.4,
  130 + floor(random() * 50)::int,
  260 + floor(random() * 70)::int,
  92.00 + (random() * 18),
  46000 + floor(random() * 5000)::int
FROM generate_series(0, 23);

-- Contract Review
INSERT INTO pipeline_metrics (pipeline_id, timestamp, requests, cache_hits, cache_misses, hit_rate, latency_p50, latency_p95, cost_saved, tokens_saved)
SELECT 
  '660e8400-e29b-41d4-a716-446655440005'::uuid,
  NOW() - (interval '1 hour' * generate_series(0, 23)),
  600 + floor(random() * 200)::int,
  510 + floor(random() * 70)::int,
  90 + floor(random() * 30)::int,
  85.0,
  140 + floor(random() * 50)::int,
  280 + floor(random() * 80)::int,
  68.00 + (random() * 12),
  34000 + floor(random() * 4000)::int
FROM generate_series(0, 23);

-- Code Generation
INSERT INTO pipeline_metrics (pipeline_id, timestamp, requests, cache_hits, cache_misses, hit_rate, latency_p50, latency_p95, cost_saved, tokens_saved)
SELECT 
  '660e8400-e29b-41d4-a716-446655440006'::uuid,
  NOW() - (interval '1 hour' * generate_series(0, 23)),
  1800 + floor(random() * 400)::int,
  1620 + floor(random() * 150)::int,
  180 + floor(random() * 60)::int,
  90.0,
  65 + floor(random() * 25)::int,
  140 + floor(random() * 40)::int,
  110.00 + (random() * 20),
  55000 + floor(random() * 6000)::int
FROM generate_series(0, 23);

-- Documentation Assistant
INSERT INTO pipeline_metrics (pipeline_id, timestamp, requests, cache_hits, cache_misses, hit_rate, latency_p50, latency_p95, cost_saved, tokens_saved)
SELECT 
  '660e8400-e29b-41d4-a716-446655440007'::uuid,
  NOW() - (interval '1 hour' * generate_series(0, 23)),
  400 + floor(random() * 150)::int,
  340 + floor(random() * 50)::int,
  60 + floor(random() * 25)::int,
  85.0,
  180 + floor(random() * 60)::int,
  350 + floor(random() * 90)::int,
  42.00 + (random() * 10),
  21000 + floor(random() * 3000)::int
FROM generate_series(0, 23);

-- ============================================================================
-- Sector Analytics (last 7 days)
-- ============================================================================

INSERT INTO sector_analytics (sector, date, total_requests, cache_hits, cache_misses, avg_latency, cost_saved, top_query_types)
VALUES
-- Healthcare
('healthcare', CURRENT_DATE, 55200, 50136, 5064, 105, 3685.00, '[{"type":"diagnosis","count":22080,"hitRate":92.4},{"type":"triage","count":19320,"hitRate":89.8},{"type":"medication","count":13800,"hitRate":91.2}]'::jsonb),
('healthcare', CURRENT_DATE - 1, 53100, 47790, 5310, 108, 3520.00, '[{"type":"diagnosis","count":21240,"hitRate":91.8},{"type":"triage","count":18585,"hitRate":89.2},{"type":"medication","count":13275,"hitRate":90.8}]'::jsonb),
('healthcare', CURRENT_DATE - 2, 51800, 46620, 5180, 110, 3430.00, '[{"type":"diagnosis","count":20720,"hitRate":91.5},{"type":"triage","count":18130,"hitRate":88.9},{"type":"medication","count":12950,"hitRate":90.5}]'::jsonb),

-- Finance
('finance', CURRENT_DATE, 79200, 72864, 6336, 62, 6534.00, '[{"type":"risk_analysis","count":31680,"hitRate":94.2},{"type":"market_data","count":27720,"hitRate":92.8},{"type":"fraud_detection","count":19800,"hitRate":88.9}]'::jsonb),
('finance', CURRENT_DATE - 1, 76500, 70380, 6120, 65, 6320.00, '[{"type":"risk_analysis","count":30600,"hitRate":93.8},{"type":"market_data","count":26775,"hitRate":92.3},{"type":"fraud_detection","count":19125,"hitRate":88.5}]'::jsonb),

-- Legal
('legal', CURRENT_DATE, 14400, 12240, 2160, 152, 1632.00, '[{"type":"contract_review","count":7200,"hitRate":87.5},{"type":"document_analysis","count":4320,"hitRate":83.3},{"type":"research","count":2880,"hitRate":80.0}]'::jsonb),
('legal', CURRENT_DATE - 1, 13900, 11815, 2085, 155, 1575.00, '[{"type":"contract_review","count":6950,"hitRate":87.2},{"type":"document_analysis","count":4170,"hitRate":82.8},{"type":"research","count":2780,"hitRate":79.5}]'::jsonb),

-- Developer
('developer', CURRENT_DATE, 52800, 47520, 5280, 92, 3696.00, '[{"type":"code_generation","count":26400,"hitRate":92.5},{"type":"documentation","count":15840,"hitRate":88.0},{"type":"debugging","count":10560,"hitRate":85.2}]'::jsonb),
('developer', CURRENT_DATE - 1, 51000, 45900, 5100, 95, 3570.00, '[{"type":"code_generation","count":25500,"hitRate":92.0},{"type":"documentation","count":15300,"hitRate":87.5},{"type":"debugging","count":10200,"hitRate":84.8}]'::jsonb)
ON CONFLICT (sector, date) DO NOTHING;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Count records
SELECT 'Workspaces' AS table_name, COUNT(*) AS record_count FROM workspaces
UNION ALL
SELECT 'Pipelines', COUNT(*) FROM pipelines
UNION ALL
SELECT 'Pipeline Metrics', COUNT(*) FROM pipeline_metrics
UNION ALL
SELECT 'Sector Analytics', COUNT(*) FROM sector_analytics;

-- Sample data from views
SELECT * FROM pipeline_performance_24h LIMIT 5;
SELECT * FROM sector_dashboard_metrics;
