CREATE TABLE IF NOT EXISTS "agent_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_principal_id" text NOT NULL,
  "organization_id" uuid,
  "provider" text NOT NULL,
  "display_name" text,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "verification_status" text DEFAULT 'unverified' NOT NULL,
  "encrypted_credentials" text,
  "encryption_key_version" text DEFAULT 'v1' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp,
  "revoked_at" timestamp,
  CONSTRAINT "agent_connections_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_connections_owner_status_idx"
  ON "agent_connections" USING btree ("owner_principal_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_connections_org_idx"
  ON "agent_connections" USING btree ("organization_id");
