-- Migration 003: Add Tier System
-- Adds tier, subscription, and Stripe-related columns to api_keys table

-- Add tier and subscription columns
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_tier ON api_keys(tier);
CREATE INDEX IF NOT EXISTS idx_api_keys_stripe_customer ON api_keys(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_stripe_subscription ON api_keys(stripe_subscription_id);

-- Set all existing keys to free tier
UPDATE api_keys SET tier = 'free' WHERE tier IS NULL;

-- Optional: Grandfather early adopters with high usage
-- Uncomment if you want to reward early users
-- UPDATE api_keys 
-- SET tier = 'pro', subscription_status = 'grandfathered'
-- WHERE created_at < '2025-01-01' AND request_count > 50000;

-- Create audit log table for tier changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  target TEXT NOT NULL,
  reason TEXT,
  admin_user VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Add comment for documentation
COMMENT ON COLUMN api_keys.tier IS 'User tier: free, pro, or enterprise';
COMMENT ON COLUMN api_keys.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN api_keys.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN api_keys.subscription_status IS 'Subscription status: active, canceled, past_due, grandfathered';
