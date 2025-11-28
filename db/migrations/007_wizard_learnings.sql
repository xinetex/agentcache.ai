-- Migration 007: Wizard Learnings Table
-- Store successful pipeline patterns for AI recommendations

CREATE TABLE IF NOT EXISTS wizard_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  sector VARCHAR(100) NOT NULL,
  use_case TEXT NOT NULL,
  node_config JSONB NOT NULL,
  performance_metrics JSONB DEFAULT '{}',
  success_score INTEGER DEFAULT 50 CHECK (success_score >= 0 AND success_score <= 100),
  learned_at TIMESTAMP DEFAULT NOW(),
  times_recommended INTEGER DEFAULT 0,
  times_adopted INTEGER DEFAULT 0,
  UNIQUE(pipeline_id)
);

CREATE INDEX idx_wizard_learnings_sector ON wizard_learnings(sector);
CREATE INDEX idx_wizard_learnings_use_case ON wizard_learnings USING gin(to_tsvector('english', use_case));
CREATE INDEX idx_wizard_learnings_success_score ON wizard_learnings(success_score DESC);
CREATE INDEX idx_wizard_learnings_learned_at ON wizard_learnings(learned_at DESC);

-- Function to increment recommendation count
CREATE OR REPLACE FUNCTION increment_wizard_recommendation(learning_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE wizard_learnings
  SET times_recommended = times_recommended + 1
  WHERE id = learning_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment adoption count
CREATE OR REPLACE FUNCTION increment_wizard_adoption(learning_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE wizard_learnings
  SET times_adopted = times_adopted + 1
  WHERE id = learning_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE wizard_learnings IS 'Stores successful pipeline patterns for AI recommendations';
COMMENT ON COLUMN wizard_learnings.node_config IS 'Full node configuration that was successful';
COMMENT ON COLUMN wizard_learnings.performance_metrics IS 'Actual performance metrics (hit_rate, latency, throughput)';
COMMENT ON COLUMN wizard_learnings.success_score IS 'Calculated success score 0-100 based on metrics';
COMMENT ON COLUMN wizard_learnings.times_recommended IS 'How many times this pattern was recommended';
COMMENT ON COLUMN wizard_learnings.times_adopted IS 'How many times users accepted this recommendation';
