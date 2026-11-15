ALTER TABLE "execution_invocations"
  ADD COLUMN IF NOT EXISTS "approval_gate_id" text,
  ADD COLUMN IF NOT EXISTS "approval_receipt_id" text;
