
-- 1. Ensure Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    plan text DEFAULT 'free',
    region text DEFAULT 'us-east-1',
    created_at timestamp DEFAULT now()
);

-- 2. Ensure Users Table
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text,
    name text,
    avatar_url text,
    role text DEFAULT 'user',
    plan text DEFAULT 'free',
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- 3. Ensure Members Table
CREATE TABLE IF NOT EXISTS members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id),
    user_id uuid REFERENCES users(id),
    role text DEFAULT 'viewer',
    joined_at timestamp DEFAULT now()
);

-- 4. Ensure API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id),
    prefix text NOT NULL,
    hash text NOT NULL,
    scopes text[],
    last_used_at timestamp,
    created_at timestamp DEFAULT now(),
    expires_at timestamp
);

-- 5. Force Add Columns (Idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
