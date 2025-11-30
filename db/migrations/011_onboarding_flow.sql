-- Migration: Add onboarding flow support
-- Enables: signup → wizard → personalized workspace

-- Add onboarding tracking to users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_completed) WHERE onboarding_completed = FALSE;

-- Add starter pipeline metadata to pipelines
ALTER TABLE pipelines 
  ADD COLUMN IF NOT EXISTS is_starter BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS projected_savings DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS estimated_hit_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS wizard_prompt TEXT;

CREATE INDEX IF NOT EXISTS idx_pipelines_starter ON pipelines(is_starter, user_id) WHERE is_starter = TRUE;

-- Update organizations to track onboarding source
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_source TEXT DEFAULT 'manual'; -- manual, signup_wizard, api

-- Create view for user onboarding status
CREATE OR REPLACE VIEW user_onboarding_status AS
SELECT 
  u.id as user_id,
  u.email,
  u.onboarding_completed,
  u.first_login,
  u.created_at as signup_date,
  o.id as organization_id,
  o.name as organization_name,
  o.sector,
  COUNT(p.id) as pipeline_count,
  COUNT(CASE WHEN p.is_starter THEN 1 END) as starter_pipeline_count,
  COUNT(ak.id) as api_key_count
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
LEFT JOIN pipelines p ON u.id = p.user_id
LEFT JOIN api_keys ak ON u.id = ak.user_id
GROUP BY u.id, u.email, u.onboarding_completed, u.first_login, u.created_at, 
         o.id, o.name, o.sector;

COMMENT ON VIEW user_onboarding_status IS 'Track user onboarding progress and completion';
