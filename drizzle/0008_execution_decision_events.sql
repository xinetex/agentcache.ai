CREATE TABLE IF NOT EXISTS "execution_decision_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" text NOT NULL,
  "execution_run_id" text NOT NULL,
  "context_pack_id" text,
  "context_pack_version_id" text,
  "owner_principal_id" text,
  "actor_principal_id" text,
  "organization_id" text,
  "actor_role" text,
  "verdict" text,
  "summary" text,
  "findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "confidence" real,
  "status" text,
  "phase" text,
  "receipt_id" text,
  "occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_decision_events_run_idx"
  ON "execution_decision_events" USING btree ("execution_run_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_decision_events_principal_idx"
  ON "execution_decision_events" USING btree ("owner_principal_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_decision_events_org_idx"
  ON "execution_decision_events" USING btree ("organization_id", "occurred_at");
