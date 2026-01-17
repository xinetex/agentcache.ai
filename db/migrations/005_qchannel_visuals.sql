-- Migration: 005_qchannel_visuals.sql
-- Purpose: Store rotating visual content (backgrounds, screensayers, NFT art)

CREATE TABLE IF NOT EXISTS qchannel_visuals (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'background', -- 'background', 'nft', 'screensaver'
    title VARCHAR(255),
    artist VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast retrieval by type
CREATE INDEX idx_qchannel_visuals_type ON qchannel_visuals(type);
CREATE INDEX idx_qchannel_visuals_active ON qchannel_visuals(is_active);
