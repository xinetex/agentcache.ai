CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by_user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamp NOT NULL,
  accepted_at timestamp,
  canceled_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_invitations_org_idx
  ON organization_invitations USING btree (organization_id, created_at);
CREATE INDEX IF NOT EXISTS organization_invitations_email_idx
  ON organization_invitations USING btree (email);
