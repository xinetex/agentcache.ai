ALTER TABLE "execution_invocations"
  ADD COLUMN IF NOT EXISTS "idempotency_key_hash" text,
  ADD COLUMN IF NOT EXISTS "request_hash" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "execution_invocations_idempotency_unique"
  ON "execution_invocations" USING btree ("principal_id", "idempotency_key_hash")
  WHERE "idempotency_key_hash" IS NOT NULL;
