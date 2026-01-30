-- Credits Top-Off Billing System
-- AgentCache.ai

-- User credit balances (extend users table)
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance real DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_credits_purchased real DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_credits_used real DEFAULT 0;

-- Auto top-off settings
CREATE TABLE IF NOT EXISTS auto_topoff_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled boolean DEFAULT false,
    threshold_credits real DEFAULT 100,
    topoff_package text DEFAULT 'pack_2500',
    stripe_payment_method_id text,
    last_topoff_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(user_id)
);

-- Credit transactions (purchases, usage, refunds, bonuses)
CREATE TABLE IF NOT EXISTS credit_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'purchase', 'usage', 'refund', 'bonus', 'auto_topoff'
    amount real NOT NULL, -- Positive for credits in, negative for credits out
    balance_after real NOT NULL, -- Balance after this transaction
    description text,
    
    -- For purchases
    package_id text,
    stripe_payment_intent_id text,
    stripe_checkout_session_id text,
    
    -- For usage
    service text, -- 'cache_read', 'ai_embedding', etc.
    resource_id text, -- Optional: file ID, pipeline ID, etc.
    quantity real,
    
    -- Metadata
    metadata jsonb,
    created_at timestamp DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS credit_tx_user_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_tx_created_idx ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS credit_tx_type_idx ON credit_transactions(type);

-- Usage aggregation (daily rollup for analytics)
CREATE TABLE IF NOT EXISTS credit_usage_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date date NOT NULL,
    
    -- Aggregated usage by service
    cache_reads integer DEFAULT 0,
    cache_writes integer DEFAULT 0,
    cache_semantic integer DEFAULT 0,
    ai_embeddings integer DEFAULT 0,
    ai_completions_tokens integer DEFAULT 0,
    transcode_minutes real DEFAULT 0,
    storage_gb real DEFAULT 0,
    egress_gb real DEFAULT 0,
    edge_invocations integer DEFAULT 0,
    
    -- Totals
    total_credits_used real DEFAULT 0,
    
    created_at timestamp DEFAULT now(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS credit_usage_daily_user_date_idx ON credit_usage_daily(user_id, date DESC);
