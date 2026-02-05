-- Migration 013: Badge Tiers (Incentive System)
-- Scout → Analyst → Oracle based on contribution count
-- Phase 2 of AgentCache Platform for Bot Needs

CREATE TABLE IF NOT EXISTS hub_agent_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES hub_agents(id) ON DELETE CASCADE,
  badge TEXT NOT NULL, -- 'scout', 'analyst', 'oracle'
  reason TEXT,
  awarded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_agent_badges_agent_idx ON hub_agent_badges(agent_id);
CREATE INDEX IF NOT EXISTS hub_agent_badges_badge_idx ON hub_agent_badges(badge);

-- Prevent duplicate badge awards per agent
CREATE UNIQUE INDEX IF NOT EXISTS hub_agent_badges_unique ON hub_agent_badges(agent_id, badge);
