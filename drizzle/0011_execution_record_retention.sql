ALTER TABLE "execution_invocations"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp NOT NULL DEFAULT (now() + interval '365 days');
--> statement-breakpoint
ALTER TABLE "execution_decision_events"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp NOT NULL DEFAULT (now() + interval '365 days');
--> statement-breakpoint
ALTER TABLE "execution_control_records"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp NOT NULL DEFAULT (now() + interval '365 days');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_invocations_expiry_idx"
  ON "execution_invocations" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_decision_events_expiry_idx"
  ON "execution_decision_events" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_control_records_expiry_idx"
  ON "execution_control_records" USING btree ("expires_at");
