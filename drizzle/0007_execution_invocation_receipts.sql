ALTER TABLE "execution_invocations"
  ADD COLUMN IF NOT EXISTS "context_pack_version_id" text,
  ADD COLUMN IF NOT EXISTS "run_receipt_id" text;
