-- Migration 008: Add config column to pipelines table
-- Wizard system stores full configuration in single JSONB column

-- Add config column if it doesn't exist
ALTER TABLE pipelines 
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Create index for config querying
CREATE INDEX IF NOT EXISTS idx_pipelines_config ON pipelines USING gin(config);

-- Comment
COMMENT ON COLUMN pipelines.config IS 'Full pipeline configuration including nodes, connections, and settings (used by wizard system)';
