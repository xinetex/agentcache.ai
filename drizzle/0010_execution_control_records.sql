CREATE TABLE IF NOT EXISTS "execution_control_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "record_type" text NOT NULL,
  "record_id" text NOT NULL,
  "owner_principal_id" text,
  "organization_id" text,
  "payload" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "execution_control_records_identity_idx"
  ON "execution_control_records" USING btree ("record_type", "record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_control_records_owner_idx"
  ON "execution_control_records" USING btree ("owner_principal_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_control_records_org_idx"
  ON "execution_control_records" USING btree ("organization_id", "updated_at");
