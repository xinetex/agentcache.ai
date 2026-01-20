-- Device Linking and Points System
-- Run this migration to add device_activations and user_points

-- =====================================================
-- DEVICE ACTIVATIONS: Roku/TV linking flow
-- =====================================================
CREATE TABLE IF NOT EXISTS device_activations (
  code VARCHAR(6) PRIMARY KEY, -- Short code e.g. "ABCD12"
  roku_serial VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'linked', 'expired'
  user_id UUID, -- Linked user (nullable until linked)
  device_name VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL, -- Code expiration (short lived)
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for identifying device by serial to prevent duplicates/spam
CREATE INDEX idx_device_activations_serial ON device_activations(roku_serial);
CREATE INDEX idx_device_activations_status ON device_activations(status);

-- =====================================================
-- USER POINTS: Gamification ledger
-- =====================================================
CREATE TABLE IF NOT EXISTS user_points (
  user_id UUID PRIMARY KEY, -- Maps to users table or auth identity
  
  -- Balance
  total_points INTEGER DEFAULT 0,
  level VARCHAR(50) DEFAULT 'Bronze',
  
  -- History/Meta
  last_earned_at TIMESTAMP,
  streak_days INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_points_level ON user_points(level);
