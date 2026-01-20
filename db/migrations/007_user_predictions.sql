-- User Predictions Table
-- Tracks active forecasts and results for the Points System

CREATE TABLE IF NOT EXISTS user_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(255) NOT NULL,
  
  -- The Bet
  symbol VARCHAR(20) NOT NULL, -- e.g. "BTC"
  direction VARCHAR(10) NOT NULL, -- "UP" or "DOWN"
  timeframe VARCHAR(20) DEFAULT '24H',
  
  -- Price Data
  entry_price DECIMAL(20, 8) NOT NULL,
  target_price DECIMAL(20, 8), -- Optional user target
  close_price DECIMAL(20, 8), -- Final price upon resolution
  
  -- Status
  status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN', 'WON', 'LOST', 'VOID'
  points_awarded INTEGER DEFAULT 0,
  
  -- Metadata
  rationale TEXT, -- "I think whales are buying"
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_predictions_wallet ON user_predictions(wallet_address);
CREATE INDEX idx_user_predictions_status ON user_predictions(status);
