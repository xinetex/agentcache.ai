-- Bring legacy API key columns in line with the current auth/schema contract.
-- Keep existing organization keys valid while enabling user-attributed keys.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'org_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'organization_id') THEN
    ALTER TABLE api_keys RENAME COLUMN org_id TO organization_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'prefix')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'key_prefix') THEN
    ALTER TABLE api_keys RENAME COLUMN prefix TO key_prefix;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'hash')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'key_hash') THEN
    ALTER TABLE api_keys RENAME COLUMN hash TO key_hash;
  END IF;
END $$;

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS allowed_namespaces text[];
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS request_count integer DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at timestamp;

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys USING btree (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys USING btree (key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_org_active_idx ON api_keys USING btree (organization_id, is_active);
CREATE INDEX IF NOT EXISTS api_keys_org_created_idx ON api_keys USING btree (organization_id, created_at);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys USING btree (user_id);
CREATE INDEX IF NOT EXISTS api_keys_active_idx ON api_keys USING btree (is_active);
