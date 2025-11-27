-- Workspaces table for storing scanned project pipelines
-- Created: 2025-11-27

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY, -- Format: ws_{timestamp}_{random}
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Workspace details
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  
  -- Pipeline and scan data (stored as JSONB)
  pipeline_data JSONB NOT NULL, -- Studio pipeline format (nodes, edges)
  scan_results JSONB, -- ProjectScannerWizard scan results
  recommendations JSONB, -- AI-generated recommendations
  integration_code TEXT, -- Generated integration code
  mesh_network JSONB, -- Mesh network visualization data
  metrics JSONB, -- Pipeline metrics (complexity, savings, etc.)
  
  -- Source tracking
  source TEXT DEFAULT 'studio', -- 'studio', 'scan', 'import'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_sector CHECK (sector IN (
    'filestorage', 'healthcare', 'finance', 'legal', 
    'education', 'ecommerce', 'enterprise', 'developer', 
    'datascience', 'government', 'general'
  ))
);

-- Indexes for performance
CREATE INDEX idx_workspaces_user ON workspaces(user_id);
CREATE INDEX idx_workspaces_sector ON workspaces(sector);
CREATE INDEX idx_workspaces_created ON workspaces(created_at DESC);
CREATE INDEX idx_workspaces_updated ON workspaces(updated_at DESC);

-- Full-text search on workspace names (optional)
CREATE INDEX idx_workspaces_name_search ON workspaces USING gin(to_tsvector('english', name));

-- Comments
COMMENT ON TABLE workspaces IS 'User workspaces created from project scans or Studio';
COMMENT ON COLUMN workspaces.id IS 'Workspace ID generated client-side (ws_{timestamp}_{random})';
COMMENT ON COLUMN workspaces.pipeline_data IS 'Studio pipeline format with nodes and edges';
COMMENT ON COLUMN workspaces.scan_results IS 'Raw scan results from ProjectScannerWizard';
COMMENT ON COLUMN workspaces.recommendations IS 'AI-generated sector detection and recommendations';
COMMENT ON COLUMN workspaces.mesh_network IS 'Infrastructure mesh network visualization data';
