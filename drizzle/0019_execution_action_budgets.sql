CREATE TABLE IF NOT EXISTS execution_action_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('organization', 'principal')),
  scope_id text NOT NULL,
  period_start timestamp NOT NULL,
  period_end timestamp NOT NULL,
  action_limit integer NOT NULL CHECK (action_limit > 0),
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  configured_by text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT execution_action_budgets_period_check CHECK (period_end > period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS execution_action_budgets_scope_unique
  ON execution_action_budgets (scope_type, scope_id);
CREATE INDEX IF NOT EXISTS execution_action_budgets_period_idx
  ON execution_action_budgets (period_end);

CREATE TABLE IF NOT EXISTS execution_action_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  budget_id uuid NOT NULL REFERENCES execution_action_budgets(id) ON DELETE CASCADE,
  invocation_id uuid NOT NULL REFERENCES execution_invocations(id) ON DELETE CASCADE,
  execution_run_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS execution_action_reservations_invocation_unique
  ON execution_action_reservations (invocation_id);
CREATE INDEX IF NOT EXISTS execution_action_reservations_budget_idx
  ON execution_action_reservations (budget_id, created_at);
