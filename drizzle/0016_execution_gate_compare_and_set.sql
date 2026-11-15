ALTER TABLE "execution_control_records"
  ADD COLUMN IF NOT EXISTS "status" text;
--> statement-breakpoint
UPDATE "execution_control_records"
SET "status" = "payload"->>'status'
WHERE "status" IS NULL AND "payload" ? 'status';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_control_records_type_status_idx"
  ON "execution_control_records" USING btree ("record_type", "status");
