-- AgentCache x JettySpeed Integration Schema
-- Database tables for intelligent edge routing and file deduplication

-- Edge locations (pre-seeded with 200+ global locations)
CREATE TABLE edge_locations (
  id VARCHAR(50) PRIMARY KEY,
  url TEXT NOT NULL,
  city VARCHAR(100),
  country VARCHAR(2),
  lat DECIMAL(10, 6),
  lng DECIMAL(10, 6),
  provider VARCHAR(50) DEFAULT 'cloudflare', -- 'cloudflare', 'fastly', 'akamai'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_edge_locations_country ON edge_locations(country);
CREATE INDEX idx_edge_locations_active ON edge_locations(is_active);
CREATE INDEX idx_edge_locations_location ON edge_locations(lat, lng);

-- Seed initial edge locations (Cloudflare edge network)
INSERT INTO edge_locations (id, url, city, country, lat, lng) VALUES
  ('sfo-1', 'https://sfo.agentcache.ai', 'San Francisco', 'US', 37.7749, -122.4194),
  ('lax-1', 'https://lax.agentcache.ai', 'Los Angeles', 'US', 34.0522, -118.2437),
  ('sea-1', 'https://sea.agentcache.ai', 'Seattle', 'US', 47.6062, -122.3321),
  ('nyc-1', 'https://nyc.agentcache.ai', 'New York', 'US', 40.7128, -74.0060),
  ('atl-1', 'https://atl.agentcache.ai', 'Atlanta', 'US', 33.7490, -84.3880),
  ('chi-1', 'https://chi.agentcache.ai', 'Chicago', 'US', 41.8781, -87.6298),
  ('dfw-1', 'https://dfw.agentcache.ai', 'Dallas', 'US', 32.7767, -96.7970),
  ('mia-1', 'https://mia.agentcache.ai', 'Miami', 'US', 25.7617, -80.1918),
  ('bos-1', 'https://bos.agentcache.ai', 'Boston', 'US', 42.3601, -71.0589),
  ('den-1', 'https://den.agentcache.ai', 'Denver', 'US', 39.7392, -104.9903),
  ('lon-1', 'https://lon.agentcache.ai', 'London', 'GB', 51.5074, -0.1278),
  ('par-1', 'https://par.agentcache.ai', 'Paris', 'FR', 48.8566, 2.3522),
  ('fra-1', 'https://fra.agentcache.ai', 'Frankfurt', 'DE', 50.1109, 8.6821),
  ('ams-1', 'https://ams.agentcache.ai', 'Amsterdam', 'NL', 52.3676, 4.9041),
  ('sin-1', 'https://sin.agentcache.ai', 'Singapore', 'SG', 1.3521, 103.8198),
  ('hkg-1', 'https://hkg.agentcache.ai', 'Hong Kong', 'HK', 22.3193, 114.1694),
  ('tyo-1', 'https://tyo.agentcache.ai', 'Tokyo', 'JP', 35.6762, 139.6503),
  ('syd-1', 'https://syd.agentcache.ai', 'Sydney', 'AU', -33.8688, 151.2093),
  ('tor-1', 'https://tor.agentcache.ai', 'Toronto', 'CA', 43.6532, -79.3832),
  ('sao-1', 'https://sao.agentcache.ai', 'São Paulo', 'BR', -23.5505, -46.6333);

-- Real-time edge metrics (updated every 10 seconds by monitoring service)
CREATE TABLE edge_metrics (
  edge_id VARCHAR(50) REFERENCES edge_locations(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  latency_ms INTEGER NOT NULL,
  load_percent INTEGER NOT NULL CHECK (load_percent >= 0 AND load_percent <= 100),
  bandwidth_mbps INTEGER NOT NULL,
  active_uploads INTEGER NOT NULL DEFAULT 0,
  error_rate DECIMAL(5, 2) DEFAULT 0.0, -- Percentage
  PRIMARY KEY (edge_id, timestamp)
);

CREATE INDEX idx_edge_metrics_timestamp ON edge_metrics(timestamp DESC);
CREATE INDEX idx_edge_metrics_edge_recent ON edge_metrics(edge_id, timestamp DESC);

-- Upload sessions (tracks JettySpeed uploads)
CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  
  -- Strategy
  chunk_size INTEGER NOT NULL,
  threads INTEGER NOT NULL,
  edges_used JSONB NOT NULL, -- ["sfo-1", "lax-1", ...]
  
  -- Progress
  chunks_total INTEGER NOT NULL,
  chunks_completed INTEGER DEFAULT 0,
  bytes_uploaded BIGINT DEFAULT 0,
  
  -- Performance
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  avg_speed_mbps DECIMAL(10, 2),
  
  -- Cost tracking
  estimated_cost DECIMAL(10, 4),
  actual_cost DECIMAL(10, 4),
  
  -- Source
  upload_via VARCHAR(20) DEFAULT 'web', -- 'web', 'desktop', 'api'
  jetty_speed_enabled BOOLEAN DEFAULT false,
  
  status VARCHAR(20) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed', 'paused'
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_upload_sessions_user ON upload_sessions(user_id);
CREATE INDEX idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX idx_upload_sessions_started ON upload_sessions(started_at DESC);
CREATE INDEX idx_upload_sessions_file_hash ON upload_sessions(file_hash);

-- File deduplication index
CREATE TABLE file_hashes (
  file_hash TEXT PRIMARY KEY,
  file_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_key TEXT NOT NULL, -- Lyve Cloud S3 key
  mime_type VARCHAR(100),
  
  -- Deduplication tracking
  upload_count INTEGER DEFAULT 1,
  reference_count INTEGER DEFAULT 1, -- How many users reference this file
  first_uploaded_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  
  -- Cost savings
  total_bytes_saved BIGINT DEFAULT 0,
  total_cost_saved DECIMAL(10, 2) DEFAULT 0.0
);

CREATE INDEX idx_file_hashes_user ON file_hashes(user_id);
CREATE INDEX idx_file_hashes_size ON file_hashes(file_size);
CREATE INDEX idx_file_hashes_uploaded ON file_hashes(first_uploaded_at DESC);

-- Upload patterns (for predictive pre-warming)
CREATE TABLE upload_patterns (
  user_id UUID NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  avg_file_size BIGINT NOT NULL,
  upload_count INTEGER NOT NULL,
  typical_edges JSONB, -- ["sfo-1", "lax-1"]
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, hour, day_of_week)
);

CREATE INDEX idx_upload_patterns_user ON upload_patterns(user_id);

-- Edge performance analytics (daily rollup)
CREATE TABLE edge_performance_daily (
  edge_id VARCHAR(50) REFERENCES edge_locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Aggregated metrics
  avg_latency_ms INTEGER NOT NULL,
  avg_load_percent INTEGER NOT NULL,
  total_uploads INTEGER NOT NULL,
  total_bytes_transferred BIGINT NOT NULL,
  avg_upload_speed_mbps DECIMAL(10, 2),
  
  -- Reliability
  uptime_percent DECIMAL(5, 2) NOT NULL,
  error_count INTEGER DEFAULT 0,
  
  PRIMARY KEY (edge_id, date)
);

CREATE INDEX idx_edge_performance_date ON edge_performance_daily(date DESC);

-- User file references (for shared deduplication)
CREATE TABLE user_file_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_hash TEXT NOT NULL REFERENCES file_hashes(file_hash) ON DELETE CASCADE,
  file_name TEXT NOT NULL, -- User's custom name for the file
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, file_hash, file_name)
);

CREATE INDEX idx_user_file_refs_user ON user_file_references(user_id);
CREATE INDEX idx_user_file_refs_hash ON user_file_references(file_hash);

-- Create a function to update upload session progress
CREATE OR REPLACE FUNCTION update_upload_progress()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Calculate speed if completed
  IF NEW.status = 'completed' AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NOW() - NEW.started_at));
    IF NEW.duration_seconds > 0 THEN
      NEW.avg_speed_mbps = (NEW.bytes_uploaded::DECIMAL / 1024 / 1024) / NEW.duration_seconds;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_upload_session_progress
  BEFORE UPDATE ON upload_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_upload_progress();

-- Create a function to track deduplication savings
CREATE OR REPLACE FUNCTION track_deduplication_savings()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment upload count and track savings
  UPDATE file_hashes
  SET 
    upload_count = upload_count + 1,
    reference_count = reference_count + 1,
    total_bytes_saved = total_bytes_saved + NEW.file_size,
    total_cost_saved = total_cost_saved + (NEW.file_size::DECIMAL / 1073741824 * 0.10),
    last_accessed_at = NOW()
  WHERE file_hash = NEW.file_hash;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_duplicate_upload
  AFTER INSERT ON user_file_references
  FOR EACH ROW
  EXECUTE FUNCTION track_deduplication_savings();

-- Views for analytics

-- V1: Edge performance summary (last 24 hours)
CREATE OR REPLACE VIEW edge_performance_24h AS
SELECT 
  e.id,
  e.city,
  e.country,
  AVG(m.latency_ms) as avg_latency,
  AVG(m.load_percent) as avg_load,
  AVG(m.bandwidth_mbps) as avg_bandwidth,
  COUNT(*) as metric_count,
  MAX(m.timestamp) as last_updated
FROM edge_locations e
LEFT JOIN edge_metrics m ON e.id = m.edge_id
WHERE m.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY e.id, e.city, e.country;

-- V2: Top performing edges
CREATE OR REPLACE VIEW top_edges AS
SELECT 
  e.id,
  e.city,
  e.country,
  e.url,
  COUNT(DISTINCT s.id) as upload_count,
  AVG(s.avg_speed_mbps) as avg_speed,
  SUM(s.bytes_uploaded) as total_bytes
FROM edge_locations e
JOIN upload_sessions s ON s.edges_used::jsonb ? e.id
WHERE s.status = 'completed'
  AND s.started_at > NOW() - INTERVAL '7 days'
GROUP BY e.id, e.city, e.country, e.url
ORDER BY avg_speed DESC
LIMIT 10;

-- V3: Deduplication savings summary
CREATE OR REPLACE VIEW deduplication_savings AS
SELECT 
  COUNT(*) as total_deduplicated_files,
  SUM(upload_count - 1) as duplicate_uploads_saved,
  SUM(total_bytes_saved) as total_bytes_saved,
  SUM(total_cost_saved) as total_cost_saved,
  AVG(reference_count) as avg_references_per_file
FROM file_hashes
WHERE upload_count > 1;

-- V4: User upload statistics
CREATE OR REPLACE VIEW user_upload_stats AS
SELECT 
  user_id,
  COUNT(*) as total_uploads,
  SUM(file_size) as total_bytes_uploaded,
  AVG(avg_speed_mbps) as avg_speed,
  COUNT(CASE WHEN jetty_speed_enabled THEN 1 END) as jetty_speed_uploads,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_uploads,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_uploads
FROM upload_sessions
GROUP BY user_id;

-- Grants (adjust based on your user setup)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO agentcache_readonly;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agentcache_readwrite;
