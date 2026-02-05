-- Migration 012: Agent Hub Profiles + Needs Mirror
-- Adds persistent hub agent profiles, API keys, onboarding responses, and MaxxEval needs mirror.

-- Hub Agents (persistent profiles)
CREATE TABLE IF NOT EXISTS hub_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  domain TEXT[] DEFAULT '{}'::text[],
  environment TEXT DEFAULT 'production',
  organization TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  strengths TEXT[] DEFAULT '{}'::text[],
  limitations TEXT[] DEFAULT '{}'::text[],
  tools TEXT[] DEFAULT '{}'::text[],
  model_backend TEXT,

  preferences JSONB DEFAULT '{}'::jsonb,
  preference_confidence REAL DEFAULT 0.1,
  success_criteria TEXT[] DEFAULT '{}'::text[],
  optimization_targets TEXT[] DEFAULT '{}'::text[],

  instruction_format TEXT DEFAULT 'natural',
  ambiguity_tolerance REAL DEFAULT 0.5,
  feedback_style TEXT DEFAULT 'immediate',
  verbosity TEXT DEFAULT 'balanced',

  rate_limits JSONB DEFAULT '{}'::jsonb,
  context_limit INTEGER DEFAULT 8192,
  cost_sensitivity REAL DEFAULT 0.5,
  guardrails TEXT[] DEFAULT '{}'::text[],

  task_history JSONB DEFAULT '[]'::jsonb,
  reflections TEXT[] DEFAULT '{}'::text[],
  last_session_id TEXT,
  session_count INTEGER DEFAULT 0,

  profile_embedding JSONB,
  last_embedding_update TIMESTAMP,
  archetype_id TEXT,
  archetype_name TEXT
);

CREATE INDEX IF NOT EXISTS hub_agents_role_idx ON hub_agents(role);
CREATE INDEX IF NOT EXISTS hub_agents_env_idx ON hub_agents(environment);
CREATE INDEX IF NOT EXISTS hub_agents_updated_idx ON hub_agents(updated_at DESC);

-- Hub Agent API Keys
CREATE TABLE IF NOT EXISTS hub_agent_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES hub_agents(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT,
  scopes TEXT[] DEFAULT '{}'::text[],
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_agent_api_keys_agent_idx ON hub_agent_api_keys(agent_id);
CREATE INDEX IF NOT EXISTS hub_agent_api_keys_hash_idx ON hub_agent_api_keys(key_hash);
CREATE UNIQUE INDEX IF NOT EXISTS hub_agent_api_keys_hash_unique ON hub_agent_api_keys(key_hash);

-- Hub Focus Group Responses (Onboarding)
CREATE TABLE IF NOT EXISTS hub_focus_group_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES hub_agents(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  stage TEXT,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_focus_group_agent_idx ON hub_focus_group_responses(agent_id);
CREATE INDEX IF NOT EXISTS hub_focus_group_session_idx ON hub_focus_group_responses(session_id);

-- Needs Mirror (MaxxEval System of Record)
CREATE TABLE IF NOT EXISTS needs_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  score INTEGER DEFAULT 0,
  raw JSONB DEFAULT '{}'::jsonb,
  external_id TEXT,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS needs_signals_unique ON needs_signals(source, type, title);
CREATE INDEX IF NOT EXISTS needs_signals_source_type_idx ON needs_signals(source, type);
CREATE INDEX IF NOT EXISTS needs_signals_updated_idx ON needs_signals(updated_at DESC);
