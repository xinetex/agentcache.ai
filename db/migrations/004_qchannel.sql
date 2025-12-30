-- QChannel Extension for AgentCache
-- Run this migration to add QChannel tables

-- =====================================================
-- ZONES: Content categories for the crypto news channel
-- =====================================================
CREATE TABLE IF NOT EXISTS qchannel_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Display info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'zap', -- lucide icon name
  color TEXT DEFAULT '#00f3ff', -- hex color
  gradient_from TEXT DEFAULT '#00f3ff',
  gradient_to TEXT DEFAULT '#bc13fe',
  
  -- Data source mappings
  coingecko_category_id TEXT, -- maps to CoinGecko category
  defillama_category TEXT, -- maps to DeFiLlama category
  
  -- Ordering and visibility
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_qchannel_zones_slug ON qchannel_zones(slug);
CREATE INDEX idx_qchannel_zones_active ON qchannel_zones(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_qchannel_zones_order ON qchannel_zones(sort_order);

-- =====================================================
-- NEWS SOURCES: RSS feeds and API endpoints for news
-- =====================================================
CREATE TABLE IF NOT EXISTS qchannel_news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source info
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'rss', 'api', 'scrape'
  url TEXT NOT NULL,
  
  -- Configuration
  refresh_interval_seconds INTEGER DEFAULT 300,
  max_items INTEGER DEFAULT 20,
  
  -- Zone association (null = global)
  zone_id UUID REFERENCES qchannel_zones(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_fetch_at TIMESTAMP,
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_source_type CHECK (source_type IN ('rss', 'api', 'scrape'))
);

CREATE INDEX idx_qchannel_news_sources_zone ON qchannel_news_sources(zone_id);
CREATE INDEX idx_qchannel_news_sources_active ON qchannel_news_sources(is_active);

-- =====================================================
-- AD PLACEMENTS: Google Ad Manager / VAST integration
-- =====================================================
CREATE TABLE IF NOT EXISTS qchannel_ad_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Placement info
  name TEXT NOT NULL,
  placement_type TEXT NOT NULL, -- 'preroll', 'midroll', 'overlay', 'companion'
  
  -- Zone association (null = global/channel-wide)
  zone_id UUID REFERENCES qchannel_zones(id) ON DELETE SET NULL,
  
  -- Ad network config (Google Ad Manager)
  ad_unit_id TEXT, -- GAM ad unit ID
  vast_tag_url TEXT, -- Direct VAST tag URL
  
  -- Targeting
  max_duration_seconds INTEGER DEFAULT 30,
  skip_offset_seconds INTEGER DEFAULT 5,
  
  -- Performance tracking
  fill_rate DECIMAL(5,2) DEFAULT 0,
  avg_cpm DECIMAL(10,2) DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_completions BIGINT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_placement_type CHECK (placement_type IN ('preroll', 'midroll', 'overlay', 'companion'))
);

CREATE INDEX idx_qchannel_ad_placements_zone ON qchannel_ad_placements(zone_id);
CREATE INDEX idx_qchannel_ad_placements_type ON qchannel_ad_placements(placement_type);

-- =====================================================
-- AD EVENTS: Tracking impressions and completions
-- =====================================================
CREATE TABLE IF NOT EXISTS qchannel_ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  placement_id UUID REFERENCES qchannel_ad_placements(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES qchannel_zones(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'impression', 'start', 'firstQuartile', 'midpoint', 'thirdQuartile', 'complete', 'skip', 'error'
  
  -- Device info
  device_type TEXT, -- 'roku', 'web', 'mobile'
  device_id TEXT, -- Roku RIDA or similar
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_event_type CHECK (event_type IN ('impression', 'start', 'firstQuartile', 'midpoint', 'thirdQuartile', 'complete', 'skip', 'error'))
);

CREATE INDEX idx_qchannel_ad_events_placement ON qchannel_ad_events(placement_id);
CREATE INDEX idx_qchannel_ad_events_type ON qchannel_ad_events(event_type);
CREATE INDEX idx_qchannel_ad_events_created ON qchannel_ad_events(created_at);

-- =====================================================
-- ANALYTICS: View and engagement tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS qchannel_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was viewed
  zone_id UUID REFERENCES qchannel_zones(id) ON DELETE SET NULL,
  content_type TEXT, -- 'zone', 'coin', 'news', 'video'
  content_id TEXT,
  
  -- Device info
  device_type TEXT,
  device_id TEXT,
  
  -- Engagement
  view_duration_seconds INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_qchannel_analytics_zone ON qchannel_analytics(zone_id);
CREATE INDEX idx_qchannel_analytics_date ON qchannel_analytics(date);
CREATE INDEX idx_qchannel_analytics_device ON qchannel_analytics(device_type);

-- =====================================================
-- SEED DATA: Default zones matching QChannel web
-- =====================================================
INSERT INTO qchannel_zones (name, slug, description, icon, color, coingecko_category_id, sort_order) VALUES
  ('Solana Ecosystem', 'solana', 'Solana blockchain projects and tokens', 'zap', '#9945FF', 'solana-ecosystem', 1),
  ('AI Agents', 'ai', 'Artificial intelligence and machine learning tokens', 'brain', '#00D9FF', 'artificial-intelligence', 2),
  ('Meme Trenches', 'memes', 'Top meme coins and community tokens', 'smile', '#FF6B35', 'meme-token', 3),
  ('Real World Assets', 'rwa', 'Tokenized real-world assets', 'building', '#10B981', 'real-world-assets-rwa', 4),
  ('NFT Market', 'nft', 'NFT platforms and marketplaces', 'image', '#EC4899', 'non-fungible-tokens-nft', 5),
  ('GameFi', 'gaming', 'Gaming and metaverse tokens', 'gamepad-2', '#F59E0B', 'gaming', 6),
  ('DeFi 2.0', 'defi', 'Decentralized finance protocols', 'trending-up', '#8B5CF6', 'decentralized-finance-defi', 7),
  ('L2 Scaling', 'layer2', 'Layer 2 scaling solutions', 'layers', '#06B6D4', 'layer-2', 8)
ON CONFLICT (slug) DO NOTHING;

-- Seed news sources
INSERT INTO qchannel_news_sources (name, source_type, url, refresh_interval_seconds) VALUES
  ('Cointelegraph', 'rss', 'https://cointelegraph.com/rss', 300),
  ('Decrypt', 'rss', 'https://decrypt.co/feed', 300),
  ('The Block', 'rss', 'https://www.theblock.co/rss.xml', 300)
ON CONFLICT DO NOTHING;

-- Seed default ad placement
INSERT INTO qchannel_ad_placements (name, placement_type, max_duration_seconds, skip_offset_seconds) VALUES
  ('Channel Preroll', 'preroll', 30, 5),
  ('Zone Midroll', 'midroll', 15, 0)
ON CONFLICT DO NOTHING;
