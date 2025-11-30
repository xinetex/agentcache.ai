-- Migration 010: Scientific Caching Laboratory System
-- Extends game tracking with scientific experiment infrastructure

-- Lab Strategies: Catalog of cache configurations
CREATE TABLE IF NOT EXISTS lab_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Strategy identification
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  version INTEGER DEFAULT 1,
  
  -- Context
  sector VARCHAR(100) NOT NULL,
  use_case TEXT NOT NULL,
  hypothesis TEXT, -- What this strategy is testing
  
  -- Configuration (L1/L2/L3 tiers)
  config JSONB NOT NULL, -- Full tier configuration with TTL, policies, routing rules
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'testing', 'validated', 'production', 'deprecated'
  
  -- Performance baseline (from validation runs)
  baseline_hit_rate DECIMAL(5,2),
  baseline_latency_p50 INTEGER,
  baseline_latency_p95 INTEGER,
  baseline_cost_per_1k DECIMAL(10,6),
  
  -- Validation
  validation_runs INTEGER DEFAULT 0,
  validation_score DECIMAL(5,2), -- Statistical confidence in baseline
  last_validated_at TIMESTAMP,
  
  -- Adoption tracking
  fork_count INTEGER DEFAULT 0, -- How many times copied
  adoption_count INTEGER DEFAULT 0, -- How many times deployed to production
  success_rate DECIMAL(5,2), -- % of adoptions that met baseline
  
  -- Authorship
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  parent_strategy_id UUID REFERENCES lab_strategies(id), -- If forked
  
  -- Metadata
  tags TEXT[], -- ['aggressive', 'hipaa-compliant', 'low-latency']
  compliance_flags TEXT[], -- ['HIPAA', 'PCI-DSS', 'SOC2']
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_lab_strategies_sector ON lab_strategies(sector);
CREATE INDEX idx_lab_strategies_status ON lab_strategies(status);
CREATE INDEX idx_lab_strategies_score ON lab_strategies(validation_score DESC NULLS LAST);
CREATE INDEX idx_lab_strategies_adoption ON lab_strategies(adoption_count DESC);
CREATE INDEX idx_lab_strategies_created ON lab_strategies(created_at DESC);

-- Lab Workloads: Synthetic test scenarios
CREATE TABLE IF NOT EXISTS lab_workloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Workload identification
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  
  -- Context
  sector VARCHAR(100) NOT NULL,
  scenario_type VARCHAR(100), -- 'monte_carlo', 'replay', 'stress_test', 'compliance_audit'
  
  -- Workload parameters
  config JSONB NOT NULL, -- { qps, duration, data_distribution, staleness_tolerance, burstiness }
  
  -- Query patterns
  query_templates JSONB NOT NULL, -- Array of query patterns with weights
  data_characteristics JSONB, -- { payload_size_kb, cardinality, freshness_requirement }
  
  -- Complexity
  total_queries INTEGER, -- Total queries in full run
  unique_queries INTEGER, -- Distinct queries
  query_distribution VARCHAR(50), -- 'uniform', 'zipfian', 'pareto', 'temporal_burst'
  
  -- Validation
  validated BOOLEAN DEFAULT false,
  represents_real_traffic BOOLEAN DEFAULT false, -- Based on production data
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  tags TEXT[],
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_lab_workloads_sector ON lab_workloads(sector);
CREATE INDEX idx_lab_workloads_type ON lab_workloads(scenario_type);
CREATE INDEX idx_lab_workloads_validated ON lab_workloads(validated);

-- Lab Experiments: Individual test runs
CREATE TABLE IF NOT EXISTS lab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Experiment setup
  strategy_id UUID REFERENCES lab_strategies(id) ON DELETE SET NULL,
  workload_id UUID REFERENCES lab_workloads(id) ON DELETE SET NULL,
  
  -- Session tracking (links to game system)
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  
  -- Configuration snapshot (in case strategy is deleted/modified)
  strategy_config JSONB NOT NULL,
  workload_config JSONB NOT NULL,
  
  -- Execution
  status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'running', 'completed', 'failed', 'cancelled'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Results: Cache performance
  total_requests INTEGER,
  l1_hits INTEGER DEFAULT 0,
  l2_hits INTEGER DEFAULT 0,
  l3_hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  hit_rate DECIMAL(5,2),
  
  -- Results: Latency distribution
  latency_p50 INTEGER,
  latency_p95 INTEGER,
  latency_p99 INTEGER,
  latency_max INTEGER,
  
  -- Results: Cost analysis
  cost_per_query DECIMAL(10,8),
  cost_per_1k_queries DECIMAL(10,6),
  cost_savings_vs_no_cache DECIMAL(10,6),
  
  -- Results: Resource utilization
  memory_used_mb INTEGER,
  cache_size_mb INTEGER,
  eviction_count INTEGER,
  invalidation_count INTEGER,
  
  -- Results: Sector-specific metrics
  compliance_violations INTEGER DEFAULT 0,
  data_freshness_violations INTEGER DEFAULT 0,
  sector_specific_metrics JSONB DEFAULT '{}',
  
  -- Statistical metadata
  confidence_interval_95 JSONB, -- { hit_rate: [lower, upper], latency_p95: [lower, upper] }
  sample_size_adequate BOOLEAN,
  
  -- Error tracking
  error_count INTEGER DEFAULT 0,
  error_details JSONB,
  
  -- Raw data (for reanalysis)
  raw_metrics JSONB,
  
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_lab_experiments_strategy ON lab_experiments(strategy_id);
CREATE INDEX idx_lab_experiments_workload ON lab_experiments(workload_id);
CREATE INDEX idx_lab_experiments_session ON lab_experiments(session_id);
CREATE INDEX idx_lab_experiments_status ON lab_experiments(status);
CREATE INDEX idx_lab_experiments_hit_rate ON lab_experiments(hit_rate DESC NULLS LAST);
CREATE INDEX idx_lab_experiments_completed ON lab_experiments(completed_at DESC NULLS LAST);

-- Lab Tournaments: Multi-strategy competitions
CREATE TABLE IF NOT EXISTS lab_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tournament setup
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Competition type
  tournament_type VARCHAR(50), -- 'round_robin', 'bracket', 'monte_carlo', 'genetic'
  
  -- Scope
  sector VARCHAR(100),
  workload_id UUID REFERENCES lab_workloads(id),
  
  -- Participants (strategies)
  strategy_ids UUID[] NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'running', 'completed', 'cancelled'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Results
  winner_strategy_id UUID REFERENCES lab_strategies(id),
  winner_score DECIMAL(5,2),
  ranking JSONB, -- Array of { strategy_id, rank, score, metrics }
  
  -- Statistical analysis
  statistical_significance BOOLEAN, -- Winner is significant at p < 0.05
  p_value DECIMAL(10,8),
  effect_size DECIMAL(5,3), -- Cohen's d
  
  -- Tournament parameters
  iterations_per_strategy INTEGER DEFAULT 1000,
  confidence_level DECIMAL(3,2) DEFAULT 0.95,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_lab_tournaments_status ON lab_tournaments(status);
CREATE INDEX idx_lab_tournaments_sector ON lab_tournaments(sector);
CREATE INDEX idx_lab_tournaments_completed ON lab_tournaments(completed_at DESC NULLS LAST);

-- Lab Predictions: ML model predictions vs actual results
CREATE TABLE IF NOT EXISTS lab_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Prediction target
  strategy_id UUID REFERENCES lab_strategies(id),
  workload_id UUID REFERENCES lab_workloads(id),
  
  -- Prediction
  predicted_hit_rate DECIMAL(5,2),
  predicted_latency_p95 INTEGER,
  predicted_cost_per_1k DECIMAL(10,6),
  confidence_score DECIMAL(5,2), -- Model confidence (0-100)
  
  -- Model metadata
  model_version VARCHAR(50),
  model_features JSONB, -- Features used for prediction
  
  -- Actual results (after experiment runs)
  experiment_id UUID REFERENCES lab_experiments(id),
  actual_hit_rate DECIMAL(5,2),
  actual_latency_p95 INTEGER,
  actual_cost_per_1k DECIMAL(10,6),
  
  -- Accuracy metrics
  hit_rate_error DECIMAL(5,2), -- abs(predicted - actual)
  latency_error INTEGER,
  cost_error DECIMAL(10,6),
  within_confidence_interval BOOLEAN,
  
  -- Timestamps
  predicted_at TIMESTAMP DEFAULT NOW(),
  validated_at TIMESTAMP
);

CREATE INDEX idx_lab_predictions_strategy ON lab_predictions(strategy_id);
CREATE INDEX idx_lab_predictions_experiment ON lab_predictions(experiment_id);
CREATE INDEX idx_lab_predictions_accuracy ON lab_predictions(within_confidence_interval);

-- Lab Evolution Log: Genetic algorithm mutations
CREATE TABLE IF NOT EXISTS lab_evolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Evolution event
  generation INTEGER NOT NULL,
  mutation_type VARCHAR(50), -- 'parameter_tweak', 'crossover', 'random_mutation'
  
  -- Parent strategies
  parent_strategy_ids UUID[],
  
  -- Child strategy
  child_strategy_id UUID REFERENCES lab_strategies(id),
  
  -- Mutation details
  mutations_applied JSONB, -- What changed from parent(s)
  
  -- Performance comparison
  parent_scores DECIMAL(5,2)[],
  child_score DECIMAL(5,2),
  fitness_improvement DECIMAL(5,2), -- % improvement over best parent
  
  -- Selection outcome
  selected_for_next_generation BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_lab_evolution_generation ON lab_evolution_log(generation);
CREATE INDEX idx_lab_evolution_child ON lab_evolution_log(child_strategy_id);
CREATE INDEX idx_lab_evolution_selected ON lab_evolution_log(selected_for_next_generation);

-- Materialized view for leaderboard performance
CREATE MATERIALIZED VIEW IF NOT EXISTS lab_strategy_leaderboard AS
SELECT 
  s.id,
  s.name,
  s.sector,
  s.validation_score,
  s.baseline_hit_rate,
  s.baseline_latency_p95,
  s.baseline_cost_per_1k,
  s.adoption_count,
  s.success_rate,
  COUNT(e.id) as total_experiments,
  AVG(e.hit_rate) as avg_hit_rate,
  AVG(e.latency_p95) as avg_latency_p95,
  AVG(e.cost_per_1k_queries) as avg_cost_per_1k,
  MAX(e.hit_rate) as best_hit_rate,
  MIN(e.latency_p95) as best_latency_p95,
  s.created_at,
  s.last_validated_at
FROM lab_strategies s
LEFT JOIN lab_experiments e ON s.id = e.strategy_id AND e.status = 'completed'
WHERE s.status IN ('validated', 'production')
GROUP BY s.id
ORDER BY s.validation_score DESC NULLS LAST, s.baseline_hit_rate DESC NULLS LAST;

CREATE UNIQUE INDEX idx_lab_leaderboard_id ON lab_strategy_leaderboard(id);

-- Refresh function (call after experiments complete)
CREATE OR REPLACE FUNCTION refresh_lab_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY lab_strategy_leaderboard;
END;
$$ LANGUAGE plpgsql;
