-- AgentCache.ai Database Schema
-- Complete backend with authentication, pipelines, and hybrid billing

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  
  -- Account status
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe ON users(stripe_customer_id);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Stripe details
  stripe_subscription_id TEXT UNIQUE,
  
  -- Plan details
  plan_tier TEXT NOT NULL, -- starter, professional, enterprise
  status TEXT NOT NULL, -- active, canceled, past_due, trialing
  
  -- Billing cycle
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_plan_tier CHECK (plan_tier IN ('starter', 'professional', 'enterprise')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete'))
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- Pipelines
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Pipeline details
  name TEXT NOT NULL,
  description TEXT,
  sector TEXT NOT NULL,
  
  -- Configuration (stored as JSONB for flexibility)
  nodes JSONB NOT NULL,
  connections JSONB NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  
  -- Complexity & pricing
  complexity_tier TEXT NOT NULL, -- simple, moderate, complex, enterprise
  complexity_score INTEGER NOT NULL,
  monthly_cost DECIMAL(10,2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, active, paused, archived
  
  -- Stripe line item (if billed separately)
  stripe_price_id TEXT,
  stripe_subscription_item_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deployed_at TIMESTAMP,
  
  CONSTRAINT valid_sector CHECK (sector IN ('healthcare', 'finance', 'legal', 'education', 'ecommerce', 'enterprise', 'developer', 'datascience', 'general')),
  CONSTRAINT valid_complexity CHECK (complexity_tier IN ('simple', 'moderate', 'complex', 'enterprise')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'paused', 'archived'))
);

CREATE INDEX idx_pipelines_user ON pipelines(user_id);
CREATE INDEX idx_pipelines_status ON pipelines(status);
CREATE INDEX idx_pipelines_complexity ON pipelines(complexity_tier);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Key details
  key_hash TEXT UNIQUE NOT NULL, -- bcrypt hash of actual key
  key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "sk_live_")
  name TEXT, -- User-friendly name
  
  -- Permissions & scope
  scopes JSONB DEFAULT '["cache:read", "cache:write"]'::jsonb,
  allowed_namespaces JSONB DEFAULT '["*"]'::jsonb, -- Array of namespace patterns
  
  -- Usage tracking
  last_used_at TIMESTAMP,
  request_count BIGINT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- NULL means no expiration
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;

-- Usage metrics (time-series data)
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  
  -- Time bucket
  timestamp TIMESTAMP NOT NULL,
  date DATE NOT NULL, -- For daily aggregation
  
  -- Metrics
  cache_requests INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  
  -- Token usage
  tokens_processed BIGINT DEFAULT 0,
  
  -- Cost tracking
  cost_baseline DECIMAL(10,2) DEFAULT 0, -- What user would've paid without cache
  cost_agentcache DECIMAL(10,2) DEFAULT 0, -- What they paid us
  cost_saved DECIMAL(10,2) DEFAULT 0, -- Difference
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_user_date ON usage_metrics(user_id, date);
CREATE INDEX idx_usage_pipeline ON usage_metrics(pipeline_id);
CREATE INDEX idx_usage_timestamp ON usage_metrics(timestamp);

-- Partition by month for performance
CREATE INDEX idx_usage_partition ON usage_metrics(date, user_id);

-- Subscription line items (detailed billing breakdown)
CREATE TABLE IF NOT EXISTS subscription_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Billing period
  billing_month DATE NOT NULL, -- First day of month
  
  -- Item details
  item_type TEXT NOT NULL, -- 'base_plan', 'pipeline', 'overage', 'addon'
  item_id UUID, -- pipeline_id if type is 'pipeline'
  description TEXT NOT NULL,
  
  -- Pricing
  quantity INTEGER DEFAULT 1,
  unit_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Stripe details
  stripe_invoice_id TEXT,
  stripe_invoice_item_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_item_type CHECK (item_type IN ('base_plan', 'pipeline', 'overage', 'addon'))
);

CREATE INDEX idx_line_items_user_month ON subscription_line_items(user_id, billing_month);
CREATE INDEX idx_line_items_subscription ON subscription_line_items(subscription_id);
CREATE INDEX idx_line_items_type ON subscription_line_items(item_type);

-- Invoices (cached from Stripe for quick access)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Stripe details
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_invoice_url TEXT,
  
  -- Invoice details
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  
  -- Status
  status TEXT NOT NULL, -- draft, open, paid, void, uncollectible
  
  -- Period
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  -- Payment
  paid_at TIMESTAMP,
  due_date TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible'))
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_period ON invoices(period_start, period_end);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Sector preferences
  enabled_sectors JSONB DEFAULT '{"healthcare": false, "finance": false, "legal": false}'::jsonb,
  
  -- Preferences
  preferences JSONB DEFAULT '{}'::jsonb,
  
  -- Notifications
  email_notifications BOOLEAN DEFAULT TRUE,
  usage_alerts BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit log (for compliance)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  -- Action
  action TEXT NOT NULL, -- 'pipeline.created', 'key.revoked', 'cache.request', etc.
  resource_type TEXT, -- 'pipeline', 'api_key', 'cache', etc.
  resource_id TEXT,
  
  -- Details
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Request info
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_timestamp ON audit_logs(created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- Views for common queries

-- User subscription summary
CREATE OR REPLACE VIEW user_subscription_summary AS
SELECT 
  u.id as user_id,
  u.email,
  s.plan_tier,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  COUNT(p.id) as total_pipelines,
  COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_pipelines,
  COALESCE(SUM(p.monthly_cost), 0) as total_pipeline_cost
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN pipelines p ON u.id = p.user_id AND p.status != 'archived'
GROUP BY u.id, u.email, s.plan_tier, s.status, s.current_period_start, s.current_period_end;

-- Monthly usage summary
CREATE OR REPLACE VIEW monthly_usage_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date) as month,
  SUM(cache_requests) as total_requests,
  SUM(cache_hits) as total_hits,
  ROUND(100.0 * SUM(cache_hits) / NULLIF(SUM(cache_requests), 0), 1) as hit_rate_pct,
  SUM(tokens_processed) as total_tokens,
  SUM(cost_baseline) as total_baseline_cost,
  SUM(cost_agentcache) as total_agentcache_cost,
  SUM(cost_saved) as total_saved
FROM usage_metrics
GROUP BY user_id, DATE_TRUNC('month', date);

-- Functions

-- Update user updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipelines_updated_at BEFORE UPDATE ON pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function to calculate current month usage
CREATE OR REPLACE FUNCTION get_current_month_usage(p_user_id UUID)
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
  FROM usage_metrics
  WHERE user_id = p_user_id
    AND date >= DATE_TRUNC('month', CURRENT_DATE)
    AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Platform Memory (Self-Hosted Cognitive Layer)
CREATE TABLE IF NOT EXISTS platform_memory_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  
  -- Cached data
  data JSONB NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.0,
  reasoning TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Usage tracking
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMP,
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  UNIQUE (namespace, cache_key)
);

CREATE INDEX idx_platform_memory_namespace ON platform_memory_cache(namespace);
CREATE INDEX idx_platform_memory_key ON platform_memory_cache(cache_key);
CREATE INDEX idx_platform_memory_confidence ON platform_memory_cache(confidence) WHERE confidence >= 0.8;
CREATE INDEX idx_platform_memory_hits ON platform_memory_cache(hit_count DESC);
CREATE INDEX idx_platform_memory_expires ON platform_memory_cache(expires_at) WHERE expires_at IS NOT NULL;

-- Platform Memory Audit (Track learning)
CREATE TABLE IF NOT EXISTS platform_memory_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  action TEXT NOT NULL, -- 'set', 'get', 'prune', 'learn'
  confidence DECIMAL(3,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_platform_audit_namespace ON platform_memory_audit(namespace);
CREATE INDEX idx_platform_audit_created ON platform_memory_audit(created_at);

-- Seed data for testing (optional - comment out for production)
-- INSERT INTO users (email, password_hash, full_name) VALUES
--   ('demo@agentcache.ai', '$2b$10$...', 'Demo User');
