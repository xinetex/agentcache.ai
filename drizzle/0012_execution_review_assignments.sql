CREATE TABLE IF NOT EXISTS "execution_review_assignments" (
  "execution_run_id" text NOT NULL,
  "reviewer_principal_id" text NOT NULL,
  "reviewer_role" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL DEFAULT (now() + interval '365 days'),
  CONSTRAINT "execution_review_assignments_identity_pk"
    PRIMARY KEY ("execution_run_id", "reviewer_principal_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_review_assignments_expiry_idx"
  ON "execution_review_assignments" USING btree ("expires_at");
