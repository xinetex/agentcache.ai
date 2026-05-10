-- AgentCache Neon cost guardrails
-- Apply in Neon SQL editor or your normal migration path.
-- Safe to rerun because every index uses IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS api_keys_hash_idx
  ON api_keys USING btree (key_hash);

CREATE INDEX IF NOT EXISTS api_keys_prefix_idx
  ON api_keys USING btree (key_prefix);

CREATE INDEX IF NOT EXISTS api_keys_org_active_idx
  ON api_keys USING btree (organization_id, is_active);

CREATE INDEX IF NOT EXISTS api_keys_org_created_idx
  ON api_keys USING btree (organization_id, created_at);

CREATE INDEX IF NOT EXISTS api_keys_user_idx
  ON api_keys USING btree (user_id);

CREATE INDEX IF NOT EXISTS api_keys_active_idx
  ON api_keys USING btree (is_active);

CREATE INDEX IF NOT EXISTS members_org_idx
  ON members USING btree (org_id);

CREATE INDEX IF NOT EXISTS members_user_idx
  ON members USING btree (user_id);

CREATE INDEX IF NOT EXISTS patterns_status_idx
  ON patterns USING btree (status);

CREATE INDEX IF NOT EXISTS patterns_status_created_idx
  ON patterns USING btree (status, created_at DESC);

CREATE INDEX IF NOT EXISTS patterns_status_name_prefix_idx
  ON patterns USING btree (status, name text_pattern_ops);

-- Background needs refresh hits this lookup pattern every 10 minutes.
CREATE INDEX IF NOT EXISTS needs_signals_source_type_title_idx
  ON needs_signals USING btree (source, type, title);
