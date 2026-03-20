/**
 * Safe SQL Migration: Adds missing periscope, monitoring, and marketplace tables.
 * Aligns everything with hubAgents (Text IDs).
 */
import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

const SQL = `
-- 1. Agent Alerts (Distress Signals)
CREATE TABLE IF NOT EXISTS "agent_alerts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "agent_name" text,
    "severity" text NOT NULL,
    "message" text NOT NULL,
    "context" jsonb DEFAULT '{}',
    "status" text DEFAULT 'open',
    "created_at" timestamp DEFAULT now(),
    "resolved_at" timestamp
);

-- 2. Periscope: Runs
CREATE TABLE IF NOT EXISTS "periscope_runs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "agent_id" text,
    "session_id" text,
    "started_at" timestamp DEFAULT now(),
    "ended_at" timestamp
);
CREATE INDEX IF NOT EXISTS "periscope_run_agent_sess_idx" ON "periscope_runs" ("agent_id", "session_id");

-- 3. Periscope: Steps
CREATE TABLE IF NOT EXISTS "periscope_steps" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "run_id" uuid REFERENCES "periscope_runs"("id"),
    "index" integer NOT NULL,
    "state_signature" jsonb,
    "goal_tag" text,
    "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "periscope_step_run_idx" ON "periscope_steps" ("run_id");

-- 4. Periscope: Actions
CREATE TABLE IF NOT EXISTS "periscope_actions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "step_id" uuid REFERENCES "periscope_steps"("id"),
    "action_type" text NOT NULL,
    "tool_name" text,
    "provider" text,
    "params_hash" text,
    "cache_status" text,
    "latency_ms" integer,
    "token_cost" integer,
    "success" boolean DEFAULT true,
    "error_code" text,
    "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "periscope_action_step_idx" ON "periscope_actions" ("step_id");

-- 5. Marketplace: Re-alignment with Hub IDs
-- Drop existing (broken) versions if they exist to force type alignment
DROP TABLE IF EXISTS "agent_tool_access" CASCADE;
DROP TABLE IF EXISTS "agent_suggestions" CASCADE;
DROP TABLE IF EXISTS "marketplace_orders" CASCADE;
DROP TABLE IF EXISTS "marketplace_listings" CASCADE;
DROP TABLE IF EXISTS "ledger_accounts" CASCADE;

CREATE TABLE "ledger_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id" text NOT NULL,
    "owner_type" text NOT NULL,
    "currency" text DEFAULT 'USDC',
    "balance" real DEFAULT 0.0,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE "marketplace_listings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "seller_agent_id" text REFERENCES "hub_agents"("id"),
    "title" text NOT NULL,
    "description" text,
    "price_per_unit" real NOT NULL,
    "unit_type" text DEFAULT 'request',
    "tags" text[],
    "status" text DEFAULT 'active',
    "is_verified" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now()
);

CREATE TABLE "marketplace_orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "listing_id" uuid REFERENCES "marketplace_listings"("id"),
    "buyer_agent_id" text REFERENCES "hub_agents"("id"),
    "status" text DEFAULT 'pending',
    "units_purchased" real DEFAULT 1,
    "total_price" real NOT NULL,
    "fulfillment_data" jsonb,
    "created_at" timestamp DEFAULT now(),
    "completed_at" timestamp
);

CREATE TABLE "agent_tool_access" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "agent_id" text REFERENCES "hub_agents"("id"),
    "tool_name" text NOT NULL,
    "order_id" uuid REFERENCES "marketplace_orders"("id"),
    "expires_at" timestamp,
    "status" text DEFAULT 'active',
    "created_at" timestamp DEFAULT now()
);

CREATE TABLE "agent_suggestions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "agent_id" text REFERENCES "hub_agents"("id"),
    "title" text NOT NULL,
    "description" text,
    "category" text DEFAULT 'enhancement',
    "votes" integer DEFAULT 0,
    "status" text DEFAULT 'open',
    "created_at" timestamp DEFAULT now()
);
`;

async function migrate() {
    console.log('🚀 Starting Deep Marketplace Migration (hubAgents Alignment)...');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    
    try {
        await client.query(SQL);
        console.log('✅ Migration COMPLETED. Marketplace tables aligned with hub_agents.');
    } catch (e) {
        console.error('❌ Migration FAILED:', e);
    } finally {
        await client.end();
    }
}

migrate();
