-- Migration: Add Organizations and Namespaces for Multi-Tenant Support
-- This enables customer portal functionality with org-scoped resources

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization details
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier (e.g., 'jettythunder')
  sector TEXT NOT NULL, -- filestorage, healthcare, finance, legal, general
  
  -- Contact info
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  
  -- Plan & limits
  plan_tier TEXT NOT NULL DEFAULT 'starter', -- free, starter, professional, enterprise
  max_namespaces INTEGER NOT NULL DEFAULT 5,
  max_api_keys INTEGER NOT NULL DEFAULT 3,
  max_users INTEGER NOT NULL DEFAULT 5,
  
  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  
  -- Status
  status TEXT DEFAULT 'active', -- active, suspended, canceled
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_sector CHECK (sector IN ('filestorage', 'healthcare', 'finance', 'legal', 'general', 'education', 'ecommerce', 'enterprise', 'developer', 'datascience')),
  CONSTRAINT valid_plan_tier CHECK (plan_tier IN ('free', 'starter', 'professional', 'enterprise')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'canceled'))
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_sector ON organizations(sector);
CREATE INDEX idx_organizations_status ON organizations(status);

-- Namespaces table (org-scoped cache namespaces)
CREATE TABLE IF NOT EXISTS namespaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Namespace details
  name TEXT NOT NULL, -- Technical name (e.g., 'storage', 'cdn')
  display_name TEXT NOT NULL, -- Human-readable name
  description TEXT,
  
  -- Configuration
  sector_nodes JSONB DEFAULT '[]'::jsonb, -- Recommended nodes for this namespace
  namespace_type TEXT DEFAULT 'standard', -- standard, tenant_template, global
  
  -- Usage tracking
  request_count BIGINT DEFAULT 0,
  last_used_at TIMESTAMP,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (organization_id, name),
  CONSTRAINT valid_namespace_type CHECK (namespace_type IN ('standard', 'tenant_template', 'global'))
);

CREATE INDEX idx_namespaces_org ON namespaces(organization_id);
CREATE INDEX idx_namespaces_active ON namespaces(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_namespaces_type ON namespaces(namespace_type);

-- Add organization_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'; -- owner, admin, member, viewer
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member', 'viewer'));

CREATE INDEX idx_users_organization ON users(organization_id);

-- Add organization_id to api_keys table
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_api_keys_organization ON api_keys(organization_id);

-- Add organization_id to pipelines table
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_pipelines_organization ON pipelines(organization_id);

-- Organization usage metrics (aggregated from usage_metrics)
CREATE TABLE IF NOT EXISTS organization_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  namespace_id UUID REFERENCES namespaces(id) ON DELETE SET NULL,
  
  -- Time bucket
  timestamp TIMESTAMP NOT NULL,
  date DATE NOT NULL,
  
  -- Metrics
  cache_requests INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  
  -- Token usage
  tokens_processed BIGINT DEFAULT 0,
  
  -- Cost tracking
  cost_baseline DECIMAL(10,2) DEFAULT 0,
  cost_agentcache DECIMAL(10,2) DEFAULT 0,
  cost_saved DECIMAL(10,2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_org_usage_org_date ON organization_usage_metrics(organization_id, date);
CREATE INDEX idx_org_usage_namespace ON organization_usage_metrics(namespace_id);
CREATE INDEX idx_org_usage_timestamp ON organization_usage_metrics(timestamp);

-- Organization settings
CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Features
  features JSONB DEFAULT '{"multi_tenant": false, "sso": false, "custom_nodes": false}'::jsonb,
  
  -- Namespace strategy
  namespace_strategy TEXT DEFAULT 'single_tenant', -- single_tenant, multi_customer
  
  -- Preferences
  preferences JSONB DEFAULT '{}'::jsonb,
  
  -- Notifications
  email_notifications BOOLEAN DEFAULT TRUE,
  usage_alerts BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Apply updated_at trigger to new tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_namespaces_updated_at BEFORE UPDATE ON namespaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_settings_updated_at BEFORE UPDATE ON organization_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View: Organization summary with usage stats
CREATE OR REPLACE VIEW organization_summary AS
SELECT 
  o.id as organization_id,
  o.name,
  o.slug,
  o.sector,
  o.plan_tier,
  o.status,
  COUNT(DISTINCT n.id) as total_namespaces,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT ak.id) as total_api_keys,
  COUNT(DISTINCT p.id) as total_pipelines,
  o.created_at
FROM organizations o
LEFT JOIN namespaces n ON o.id = n.organization_id AND n.is_active = TRUE
LEFT JOIN users u ON o.id = u.organization_id AND u.is_active = TRUE
LEFT JOIN api_keys ak ON o.id = ak.organization_id AND ak.is_active = TRUE
LEFT JOIN pipelines p ON o.id = p.organization_id AND p.status != 'archived'
GROUP BY o.id, o.name, o.slug, o.sector, o.plan_tier, o.status, o.created_at;

-- Function: Get organization current month usage
CREATE OR REPLACE FUNCTION get_org_current_month_usage(p_org_id UUID)
RETURNS TABLE (
  requests BIGINT,
  hits BIGINT,
  hit_rate DECIMAL,
  cost_saved DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(cache_requests), 0)::BIGINT as requests,
    COALESCE(SUM(cache_hits), 0)::BIGINT as hits,
    CASE 
      WHEN SUM(cache_requests) > 0 
      THEN ROUND(100.0 * SUM(cache_hits) / SUM(cache_requests), 1)
      ELSE 0
    END as hit_rate,
    COALESCE(SUM(cost_saved), 0) as cost_saved
  FROM organization_usage_metrics
  WHERE organization_id = p_org_id
    AND date >= DATE_TRUNC('month', CURRENT_DATE)
    AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Function: Get namespace usage breakdown
CREATE OR REPLACE FUNCTION get_namespace_usage(p_org_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  namespace_id UUID,
  namespace_name TEXT,
  requests BIGINT,
  hits BIGINT,
  hit_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id as namespace_id,
    n.name as namespace_name,
    COALESCE(SUM(oum.cache_requests), 0)::BIGINT as requests,
    COALESCE(SUM(oum.cache_hits), 0)::BIGINT as hits,
    CASE 
      WHEN SUM(oum.cache_requests) > 0 
      THEN ROUND(100.0 * SUM(oum.cache_hits) / SUM(oum.cache_requests), 1)
      ELSE 0
    END as hit_rate
  FROM namespaces n
  LEFT JOIN organization_usage_metrics oum ON n.id = oum.namespace_id
    AND oum.date >= CURRENT_DATE - INTERVAL '1 day' * p_days
  WHERE n.organization_id = p_org_id
    AND n.is_active = TRUE
  GROUP BY n.id, n.name
  ORDER BY requests DESC;
END;
$$ LANGUAGE plpgsql;
