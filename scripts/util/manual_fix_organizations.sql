
-- Fix missing columns in Organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS region text DEFAULT 'us-east-1';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

-- Ensure API Keys has correct columns too, just in case
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes text[];
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at timestamp;
