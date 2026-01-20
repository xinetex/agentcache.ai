-- Alpha OS: User Profiles for Agentic Session
-- Stores risk settings and "Prophecy" preferences

CREATE TABLE IF NOT EXISTS user_alpha_profiles (
  wallet_address VARCHAR(255) PRIMARY KEY,
  
  -- Core Personality
  risk_tolerance VARCHAR(50) DEFAULT 'MODERATE', -- 'DEGEN', 'AGGRESSIVE', 'MODERATE', 'CONSERVATIVE'
  investment_horizon VARCHAR(50) DEFAULT 'WEEKS', -- 'SCALP', 'DAYS', 'WEEKS', 'MONTHS', 'HODL'
  
  -- Preferences
  favorite_sectors JSONB DEFAULT '[]'::jsonb, -- e.g. ["AI", "RWA"]
  blacklisted_tokens JSONB DEFAULT '[]'::jsonb, -- e.g. ["LUNA", "FTT"]
  
  -- Agentic State
  learning_mode BOOLEAN DEFAULT TRUE, -- If true, actively learns from interactions
  last_active_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_alpha_profiles_wallet ON user_alpha_profiles(wallet_address);
