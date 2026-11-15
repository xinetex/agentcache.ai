CREATE TABLE IF NOT EXISTS "execution_invocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "execution_run_id" text NOT NULL,
  "principal_id" text NOT NULL,
  "organization_id" uuid,
  "connection_id" uuid,
  "tool_name" text NOT NULL,
  "status" text NOT NULL,
  "policy_decision" text NOT NULL,
  "input_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result_summary" jsonb,
  "error_code" text,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "execution_invocations_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL,
  CONSTRAINT "execution_invocations_connection_id_agent_connections_id_fk"
    FOREIGN KEY ("connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_invocations_run_idx"
  ON "execution_invocations" USING btree ("execution_run_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_invocations_principal_idx"
  ON "execution_invocations" USING btree ("principal_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_invocations_connection_idx"
  ON "execution_invocations" USING btree ("connection_id", "created_at");
