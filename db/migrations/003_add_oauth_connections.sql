-- Migration: Add OAuth connections table
-- Created: 2024
-- Description: Stores OAuth provider connections for users (GitHub, Google, etc.)

CREATE TABLE IF NOT EXISTS oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'github', 'google', etc.
  provider_user_id VARCHAR(255) NOT NULL, -- OAuth provider's user ID
  provider_username VARCHAR(255), -- Username/email from provider
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_id ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_provider ON oauth_connections(provider, provider_user_id);
