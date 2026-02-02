
-- Agent Marketplace & Billing Schema
-- Safe Migration: Only creates new tables if they don't exist.

-- 1. Ledger (Banking)
CREATE TABLE IF NOT EXISTS "ledger_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id" uuid NOT NULL,
    "owner_type" text NOT NULL,
    "currency" text DEFAULT 'USDC',
    "balance" real DEFAULT 0.0,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ledger_transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "from_account_id" uuid REFERENCES "ledger_accounts"("id"),
    "to_account_id" uuid REFERENCES "ledger_accounts"("id"),
    "amount" real NOT NULL,
    "currency" text DEFAULT 'USDC',
    "reference_type" text,
    "reference_id" text,
    "description" text,
    "created_at" timestamp DEFAULT now()
);

-- 2. Marketplace
CREATE TABLE IF NOT EXISTS "marketplace_listings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "seller_agent_id" uuid REFERENCES "agents"("id"),
    "title" text NOT NULL,
    "description" text,
    "price_per_unit" real NOT NULL,
    "unit_type" text DEFAULT 'request',
    "tags" text[],
    "status" text DEFAULT 'active',
    "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "marketplace_orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "listing_id" uuid REFERENCES "marketplace_listings"("id"),
    "buyer_agent_id" uuid REFERENCES "agents"("id"),
    "status" text DEFAULT 'pending',
    "units_purchased" real DEFAULT 1,
    "total_price" real NOT NULL,
    "fulfillment_data" jsonb,
    "created_at" timestamp DEFAULT now(),
    "completed_at" timestamp
);

-- 3. Governance
CREATE TABLE IF NOT EXISTS "agent_suggestions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "agent_id" uuid REFERENCES "agents"("id"),
    "title" text NOT NULL,
    "description" text,
    "category" text DEFAULT 'enhancement',
    "votes" integer DEFAULT 0,
    "status" text DEFAULT 'open',
    "created_at" timestamp DEFAULT now()
);

-- 4. Billing / Credits
CREATE TABLE IF NOT EXISTS "auto_topoff_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid REFERENCES "users"("id") NOT NULL UNIQUE,
    "enabled" boolean DEFAULT false,
    "threshold_credits" real DEFAULT 100,
    "topoff_package" text DEFAULT 'pack_2500',
    "stripe_payment_method_id" text,
    "last_topoff_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "credit_transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid REFERENCES "users"("id") NOT NULL,
    "type" text NOT NULL,
    "amount" real NOT NULL,
    "balance_after" real NOT NULL,
    "description" text,
    "package_id" text,
    "stripe_payment_intent_id" text,
    "stripe_checkout_session_id" text,
    "service" text,
    "resource_id" text,
    "quantity" real,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "credit_tx_user_idx" ON "credit_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "credit_tx_created_idx" ON "credit_transactions" ("created_at");

CREATE TABLE IF NOT EXISTS "credit_usage_daily" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid REFERENCES "users"("id") NOT NULL,
    "date" timestamp NOT NULL,
    "cache_reads" integer DEFAULT 0,
    "cache_writes" integer DEFAULT 0,
    "cache_semantic" integer DEFAULT 0,
    "ai_embeddings" integer DEFAULT 0,
    "ai_completions_tokens" integer DEFAULT 0,
    "transcode_minutes" real DEFAULT 0,
    "storage_gb" real DEFAULT 0,
    "egress_gb" real DEFAULT 0,
    "edge_invocations" integer DEFAULT 0,
    "total_credits_used" real DEFAULT 0,
    "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "credit_usage_daily_user_date_idx" ON "credit_usage_daily" ("user_id", "date");
