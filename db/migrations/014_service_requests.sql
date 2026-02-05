-- Migration 014: Service Requests (Need → Service Pipeline)
-- Phase 3: Turns high-signal needs into actionable service tickets

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  service_id TEXT NOT NULL,
  need_signal_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open', -- 'open', 'reviewing', 'building', 'shipped', 'rejected'
  config JSONB DEFAULT '{}'::jsonb,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_requests_status_idx ON service_requests(status);
CREATE INDEX IF NOT EXISTS service_requests_service_idx ON service_requests(service_id);
CREATE INDEX IF NOT EXISTS service_requests_agent_idx ON service_requests(agent_id);
