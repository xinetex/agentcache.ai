-- Migration 009: Game Results Tracking System
-- Stores every agent "play session" for evaluation and pattern discovery

-- Game Sessions: Each wizard use or pipeline experiment
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_type VARCHAR(50) NOT NULL, -- 'wizard', 'studio_experiment', 'live_data_test', 'pattern_discovery'
  
  -- Session context
  sector VARCHAR(100),
  use_case TEXT,
  goal TEXT, -- What the agent was trying to achieve
  
  -- Configuration attempted
  pipeline_config JSONB, -- Full pipeline configuration tested
  
  -- Results
  success BOOLEAN DEFAULT false,
  score INTEGER DEFAULT 0, -- Calculated success score (0-100)
  
  -- Performance metrics
  metrics JSONB DEFAULT '{}', -- { hitRate, latency, cost, throughput, etc. }
  
  -- Time tracking
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Discovery tracking
  discovered_pattern BOOLEAN DEFAULT false, -- Did this session reveal a new pattern?
  pattern_novelty_score INTEGER, -- How novel was the discovery (0-100)
  
  -- Metadata
  metadata JSONB DEFAULT '{}' -- Additional context (agent type, experiment params, etc.)
);

CREATE INDEX idx_game_sessions_user ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_type ON game_sessions(session_type);
CREATE INDEX idx_game_sessions_sector ON game_sessions(sector);
CREATE INDEX idx_game_sessions_success ON game_sessions(success);
CREATE INDEX idx_game_sessions_score ON game_sessions(score DESC);
CREATE INDEX idx_game_sessions_started ON game_sessions(started_at DESC);
CREATE INDEX idx_game_sessions_discovered ON game_sessions(discovered_pattern) WHERE discovered_pattern = true;

-- Experiment Results: Granular test data
CREATE TABLE IF NOT EXISTS experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  
  -- Test details
  test_name VARCHAR(255), -- "Crypto price caching test"
  data_source VARCHAR(255), -- API endpoint or data source ID
  
  -- Test configuration
  cache_strategy JSONB, -- { ttl, tier, invalidation_rules }
  test_parameters JSONB, -- { query_count, interval, etc. }
  
  -- Results
  total_requests INTEGER NOT NULL,
  cache_hits INTEGER NOT NULL,
  cache_misses INTEGER NOT NULL,
  hit_rate DECIMAL(5,2),
  
  -- Performance
  avg_latency_cached_ms INTEGER,
  avg_latency_uncached_ms INTEGER,
  latency_improvement_percent DECIMAL(5,2),
  
  -- Cost analysis
  cost_without_cache DECIMAL(10,6),
  cost_with_cache DECIMAL(10,6),
  cost_savings DECIMAL(10,6),
  
  -- Timestamps
  executed_at TIMESTAMP DEFAULT NOW(),
  
  -- Raw data for analysis
  raw_results JSONB -- Complete test data for deep analysis
);

CREATE INDEX idx_experiment_results_session ON experiment_results(session_id);
CREATE INDEX idx_experiment_results_source ON experiment_results(data_source);
CREATE INDEX idx_experiment_results_hit_rate ON experiment_results(hit_rate DESC);
CREATE INDEX idx_experiment_results_executed ON experiment_results(executed_at DESC);

-- Pattern Discoveries: Novel strategies found by agents
CREATE TABLE IF NOT EXISTS pattern_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
  
  -- Discovery details
  pattern_name VARCHAR(255) NOT NULL,
  pattern_description TEXT,
  
  -- Context
  sector VARCHAR(100),
  use_case TEXT,
  
  -- Pattern configuration
  configuration JSONB NOT NULL, -- The discovered optimal config
  
  -- Validation
  validated BOOLEAN DEFAULT false,
  validation_score INTEGER, -- Score from validation tests (0-100)
  times_validated INTEGER DEFAULT 0,
  
  -- Performance claims
  expected_hit_rate DECIMAL(5,2),
  expected_latency_ms INTEGER,
  expected_cost_savings DECIMAL(10,2),
  
  -- Adoption tracking
  times_recommended INTEGER DEFAULT 0,
  times_adopted INTEGER DEFAULT 0,
  adoption_success_rate DECIMAL(5,2),
  
  -- Discovery metadata
  discovered_by UUID REFERENCES users(id),
  discovered_at TIMESTAMP DEFAULT NOW(),
  
  -- Cross-sector potential
  applicable_sectors TEXT[], -- Other sectors where this might work
  
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_pattern_discoveries_sector ON pattern_discoveries(sector);
CREATE INDEX idx_pattern_discoveries_validated ON pattern_discoveries(validated);
CREATE INDEX idx_pattern_discoveries_score ON pattern_discoveries(validation_score DESC);
CREATE INDEX idx_pattern_discoveries_discovered ON pattern_discoveries(discovered_at DESC);
CREATE INDEX idx_pattern_discoveries_adoption ON pattern_discoveries(adoption_success_rate DESC);

-- Agent Leaderboard: Top performing agents/users
CREATE TABLE IF NOT EXISTS agent_leaderboard (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Game stats
  total_sessions INTEGER DEFAULT 0,
  successful_sessions INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2),
  
  -- Scoring
  total_score INTEGER DEFAULT 0,
  avg_score DECIMAL(5,2),
  highest_score INTEGER DEFAULT 0,
  
  -- Discoveries
  patterns_discovered INTEGER DEFAULT 0,
  patterns_validated INTEGER DEFAULT 0,
  patterns_adopted INTEGER DEFAULT 0,
  
  -- Performance achievements
  best_hit_rate DECIMAL(5,2),
  best_latency_ms INTEGER,
  total_cost_saved DECIMAL(10,2),
  
  -- Specialization
  primary_sector VARCHAR(100),
  sectors_explored TEXT[],
  
  -- Ranking
  global_rank INTEGER,
  sector_rank INTEGER,
  
  -- Timestamps
  first_session_at TIMESTAMP,
  last_session_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_leaderboard_rank ON agent_leaderboard(global_rank);
CREATE INDEX idx_agent_leaderboard_score ON agent_leaderboard(total_score DESC);
CREATE INDEX idx_agent_leaderboard_discoveries ON agent_leaderboard(patterns_discovered DESC);

-- Cross-Sector Intelligence Transfers
CREATE TABLE IF NOT EXISTS cross_sector_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transfer details
  source_sector VARCHAR(100) NOT NULL,
  target_sector VARCHAR(100) NOT NULL,
  
  -- Pattern transferred
  pattern_id UUID REFERENCES pattern_discoveries(id),
  pattern_config JSONB NOT NULL,
  
  -- Transfer metadata
  similarity_score DECIMAL(5,2), -- How similar are the use cases
  adaptation_needed JSONB, -- What modifications were needed
  
  -- Results
  transfer_successful BOOLEAN DEFAULT false,
  performance_delta JSONB, -- How performance changed in new sector
  
  -- Tracking
  transferred_by UUID REFERENCES users(id),
  transferred_at TIMESTAMP DEFAULT NOW(),
  validated_at TIMESTAMP
);

CREATE INDEX idx_cross_sector_source ON cross_sector_transfers(source_sector);
CREATE INDEX idx_cross_sector_target ON cross_sector_transfers(target_sector);
CREATE INDEX idx_cross_sector_successful ON cross_sector_transfers(transfer_successful);
CREATE INDEX idx_cross_sector_pattern ON cross_sector_transfers(pattern_id);

-- Functions for automatic scoring and ranking

-- Calculate session score based on performance metrics
CREATE OR REPLACE FUNCTION calculate_session_score(
  p_hit_rate DECIMAL,
  p_latency_improvement DECIMAL,
  p_cost_savings DECIMAL
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Hit rate score (40 points max)
  score := score + LEAST(40, ROUND(p_hit_rate * 40));
  
  -- Latency improvement (30 points max)
  score := score + LEAST(30, ROUND((p_latency_improvement / 100) * 30));
  
  -- Cost savings (30 points max, normalized)
  score := score + LEAST(30, ROUND((p_cost_savings / 100) * 30));
  
  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Update leaderboard automatically when session completes
CREATE OR REPLACE FUNCTION update_agent_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_leaderboard (
    user_id,
    total_sessions,
    successful_sessions,
    total_score,
    first_session_at,
    last_session_at
  )
  VALUES (
    NEW.user_id,
    1,
    CASE WHEN NEW.success THEN 1 ELSE 0 END,
    NEW.score,
    NEW.started_at,
    NEW.completed_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_sessions = agent_leaderboard.total_sessions + 1,
    successful_sessions = agent_leaderboard.successful_sessions + 
      CASE WHEN NEW.success THEN 1 ELSE 0 END,
    total_score = agent_leaderboard.total_score + NEW.score,
    avg_score = (agent_leaderboard.total_score + NEW.score) / 
      (agent_leaderboard.total_sessions + 1),
    highest_score = GREATEST(agent_leaderboard.highest_score, NEW.score),
    last_session_at = NEW.completed_at,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_leaderboard
  AFTER INSERT OR UPDATE ON game_sessions
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION update_agent_leaderboard();

-- Views for analytics

-- Top performing patterns
CREATE OR REPLACE VIEW top_patterns AS
SELECT 
  pd.id,
  pd.pattern_name,
  pd.sector,
  pd.validation_score,
  pd.times_adopted,
  pd.adoption_success_rate,
  pd.expected_hit_rate,
  pd.expected_cost_savings,
  COUNT(DISTINCT cst.id) as cross_sector_applications,
  pd.discovered_at
FROM pattern_discoveries pd
LEFT JOIN cross_sector_transfers cst ON cst.pattern_id = pd.id
WHERE pd.validated = true
GROUP BY pd.id, pd.pattern_name, pd.sector, pd.validation_score, 
         pd.times_adopted, pd.adoption_success_rate, pd.expected_hit_rate,
         pd.expected_cost_savings, pd.discovered_at
ORDER BY pd.validation_score DESC, pd.times_adopted DESC;

-- Agent performance summary
CREATE OR REPLACE VIEW agent_performance AS
SELECT
  u.id as user_id,
  u.email,
  al.total_sessions,
  al.success_rate,
  al.total_score,
  al.patterns_discovered,
  al.global_rank,
  al.primary_sector,
  ARRAY_LENGTH(al.sectors_explored, 1) as sectors_explored_count,
  al.total_cost_saved,
  al.last_session_at
FROM agent_leaderboard al
JOIN users u ON u.id = al.user_id
ORDER BY al.global_rank;

-- Cross-sector intelligence flow
CREATE OR REPLACE VIEW intelligence_flow AS
SELECT
  source_sector,
  target_sector,
  COUNT(*) as transfer_count,
  AVG(similarity_score) as avg_similarity,
  SUM(CASE WHEN transfer_successful THEN 1 ELSE 0 END) as successful_transfers,
  ROUND(100.0 * SUM(CASE WHEN transfer_successful THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM cross_sector_transfers
GROUP BY source_sector, target_sector
HAVING COUNT(*) >= 3
ORDER BY transfer_count DESC;

-- Comments
COMMENT ON TABLE game_sessions IS 'Tracks every agent play session for evaluation and learning';
COMMENT ON TABLE experiment_results IS 'Granular test data from pipeline experiments';
COMMENT ON TABLE pattern_discoveries IS 'Novel caching strategies discovered by agents';
COMMENT ON TABLE agent_leaderboard IS 'Rankings and achievements for top performing agents';
COMMENT ON TABLE cross_sector_transfers IS 'Tracks knowledge transfer between sectors';

COMMENT ON COLUMN game_sessions.score IS 'Success score 0-100 based on hit rate, latency, cost';
COMMENT ON COLUMN pattern_discoveries.validation_score IS 'Score from validation tests (0-100)';
COMMENT ON COLUMN pattern_discoveries.adoption_success_rate IS 'Percentage of adoptions that succeeded';
