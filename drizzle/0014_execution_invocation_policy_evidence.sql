ALTER TABLE "execution_invocations"
  ADD COLUMN IF NOT EXISTS "policy_version" text,
  ADD COLUMN IF NOT EXISTS "policy_rule_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "policy_reason_code" text,
  ADD COLUMN IF NOT EXISTS "policy_score" real;
