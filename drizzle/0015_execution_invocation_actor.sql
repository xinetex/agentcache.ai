ALTER TABLE "execution_invocations"
  ADD COLUMN IF NOT EXISTS "actor_principal_id" text;
