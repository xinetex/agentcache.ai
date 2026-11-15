# Governed Execution Data Operations

This runbook covers the SQL and credential-encryption prerequisites for the governed-execution pilot. The migrations create additive tables, columns, and indexes; they do not include destructive down migrations. Treat the database as the evidence source for provider calls and approval decisions.

## Current release gate (15 November 2026)

- The linked Vercel project has `DATABASE_URL` configured for Production only. Preview has Vercel Postgres aliases, but the application and migration runner read `DATABASE_URL`; a Preview alias must not be assumed to identify an isolated database.
- `AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY` is not configured in the linked project's environments. Do not accept or encrypt real provider credentials until the Preview key is set and its recovery copy is recorded.
- A read-only schema verification against the database configured by the local environment files found the execution tables and safety indexes missing. That connection's environment identity was not independently established, so treat it as potentially production and do not run migrations against it.
- A Preview schema check remains open. Verify a dedicated Preview database and configure Preview `DATABASE_URL` explicitly before applying migrations. No migrations were applied by this check.

## Before applying migrations

Before collecting real customer data, resolve the retention terms with the approved legal reviewer. The current public Terms of Service state that all account data is deleted within seven days after termination, while the governed-execution ledger is configured for 90–2555 days (365 days by default); the Privacy Policy separately describes logs as 30 days. Do not promise both schedules. Record the approved retention/deletion policy and align product configuration, Terms, Privacy Policy, and customer orders before the pilot accepts production data.

1. Choose the target environment explicitly (preview first, production only after preview acceptance). Confirm the Vercel project and branch so the migration cannot target an unintended database. For Preview, confirm the database branch/reference is isolated from Production; do not copy a Vercel Postgres alias into `DATABASE_URL` until that isolation is established.
2. Set the target environment's `DATABASE_URL` in its secure Vercel settings and confirm it points to that environment. Do not put it in shell history, a ticket, or a committed file.
3. Take or verify a recoverable database backup/PITR point under the database provider's retention policy. Record the timestamp and database branch/reference in the release record, not the connection URL.
4. Set `AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY` to a random 32-byte value encoded as base64 or 64 hex characters. Set `AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY_VERSION` to a short stable identifier (defaults to `v1`). Keep the key in the deployment secret store and a separate approved recovery store. Never use a sample/test key for real provider accounts.
5. Set `CRON_SECRET` to a separate high-entropy secret. Set `AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS` to the approved period from 90 through 2555 days (default 365).
6. Run `npm run execution:release-check` in the secured deployment environment. Resolve each `NEEDS ACTION`; `MANUAL` is still required even when all automated checks pass.

## Apply and verify

Run the journaled migrations against the selected `DATABASE_URL`:

```sh
npm run db:migrate
```

Drizzle applies unapplied entries from `drizzle/meta/_journal.json` in order. The execution additions are `0005_agent_connections` through `0019_execution_action_budgets`. Do not use `db:push` as a substitute for this release migration step.

After the command succeeds, verify the target database contains these tables and columns before deploying provider execution:

- `agent_connections`: owner, provider, scopes, encrypted credential envelope, encryption key version, state, and timestamps.
- `execution_invocations`: run and principal IDs, status, policy evidence, idempotency hashes, actor, receipt references, and `expires_at`.
- `execution_decision_events`, `execution_control_records`, and `execution_review_assignments`, including their expiry and gate-state fields.
- `api_keys`: normalized `organization_id`, `key_prefix`, and `key_hash` columns plus optional `user_id`, active/revocation state, and the user/organization indexes. Existing organization keys remain supported; new console keys are attributed to the signed-in member.
- `organization_invitations`: hashed one-time tokens, organization/email/role binding, seven-day expiry, cancellation, and acceptance timestamps.
- `execution_action_budgets` and `execution_action_reservations`: admin-configured, time-bounded limits and atomic per-invocation reservations. A governed provider action requires an active budget for its organization or principal; attempted provider calls consume one reserved action even if the provider fails. Policy denials and retries of an existing idempotent invocation do not consume another action.
- The owner, run, idempotency, status, expiry, and action-budget indexes defined in migrations `0005`–`0019`.

Run the read-only schema verifier against the same secured `DATABASE_URL` to check the critical columns and uniqueness/safety indexes:

```sh
npm run execution:verify-schema
```

It refuses mock URLs, prints only missing schema identifiers or a pass result, and never prints the connection URL. A successful schema check proves the database shape only; it does not prove row-level authorization, migration rollback readiness, or live provider behavior.

Then deploy to preview and verify, using a dedicated test account. The governed-action acceptance can be run through the actual deployed Hono routes with `npm run execution:verify-preview -- --confirm-preview` after setting the five `EXECUTION_PREVIEW_*` variables listed by the command. The owner key and approver key must belong to separate authorized members; the connection and context pack must already exist in the isolated preview. The runner creates a run, records a human gate approval, performs one read-only Jetty summary, attempts one unregistered action, and confirms both outcomes in invocation history. It prints identifiers and statuses only, never API keys, credentials, or provider results. It writes durable preview run and audit records and reserves one configured provider-attempt action. Run only after confirming the database and account are isolated from production.

The runner covers the pilot execution path. Verify these additional preview contracts separately:

1. `/api/execution/tools` returns the registered Jetty summary adapter.
2. An organization owner creates an expiring invite for a teammate, shares the one-time link out of band, and can cancel it; the invitation only grants the email-bound role.
3. The invited teammate joins or signs in, accepts the invite, and receives the right organization context; a different admin member can create a personal API key and revoke it without another member inspecting or revoking it.
4. A user-owned `storage.read` connection can be created, listed without credentials, invoked only after its run's organization owner/admin gate is approved, and disconnected.
5. An administrator configures an action budget for the pilot organization and window. Exactly the configured number of provider attempts can be reserved across organization/user API keys; a concurrent excess attempt is blocked before Jetty traffic and remains visible in history.
6. A denied call makes no provider request; an approved provider call has a durable completed invocation and approval receipt references.
7. Expired credentials, provider errors, and interrupted/incomplete writes are visible as their actual outcomes. No returned record or log contains the service key or file names.
8. The protected retention endpoint rejects a missing/wrong bearer secret and can mark stale `started` invocations `outcome_unknown` without replaying them.
9. Existing audio1.tv, JettyThunder, and ClawSave route contracts pass in the same preview before promotion.

## Configure the pilot action cap

Provider execution remains blocked until the database has an active budget for the authenticated organization (or principal, for a non-organization key). A platform administrator configures it with `npm run execution:configure-action-budget`, which calls the admin API, defaults to read-only, and reads back an applied budget for verification. Provide these values in the secured operator environment: `AGENTCACHE_BASE_URL`, `PILOT_ORGANIZATION_ID`, `PILOT_ACTION_LIMIT`, `PILOT_ACTION_PERIOD_START`, `PILOT_ACTION_PERIOD_END`, and `ADMIN_TOKEN`. Keep `ADMIN_TOKEN` in the approved secret store; do not paste it into a ticket, dashboard, or checked-in script. Start with a dry run, then apply:

```sh
npm run execution:configure-action-budget
npm run execution:configure-action-budget -- --apply
```

For a new period only, explicitly add `--new-window` with `--apply`; this confirms the counter reset. Dates must be UTC ISO timestamps, the period must not exceed 366 days, and the limit must be a positive integer. This is a **provider-attempt count limit**, not a dollar spend ceiling: provider errors consume a reservation, while policy denials and idempotent retries do not. Keep the exact window unchanged when updating the limit; configuring a different window starts a new counter. The command verifies the admin GET response; also confirm the authenticated `/api/execution/usage` response before enabling the workflow.

Do not count local provider stubs, mock-database tests, successful builds, or a green file-presence preflight as evidence of database application or live provider behavior.

## Application rollback and data recovery

- Prefer an application rollback to the prior Vercel deployment while retaining the additive schema. The previous application version should continue to ignore the new tables and columns.
- Do not drop execution tables or columns to roll back an application release. These records may be the only evidence of provider activity. A schema rollback requires a separately reviewed recovery plan, a verified backup/PITR point, a write freeze, and an explicit data-loss decision.
- If migration application fails, stop before provider execution. Capture the migration error without credentials, verify the database's applied migration journal, restore from the verified recovery point only if needed, then correct forward and re-run the migration command. Do not manually mark a migration applied to bypass a partial failure.
- If `DATABASE_URL` or the database is unavailable, fail closed for governed provider calls. Do not fall back to Redis or mock storage for durable approval/invocation evidence.

## Encryption-key recovery and rotation limits

Connections use AES-256-GCM with the connection ID and owner as authenticated associated data. `AGENTCACHE_CONNECTIONS_ENCRYPTION_KEYRING` allows the service to decrypt envelopes created under older key versions while the old key remains available.

For a planned rotation, set the new active key and version, retain every old key in `AGENTCACHE_CONNECTIONS_ENCRYPTION_KEYRING`, then run `npm run execution:rotate-connection-keys -- --apply` against the intended database. The command requires `DATABASE_URL`, refuses mock storage, uses batches of 100, and reports counts only. It compare-and-sets each ciphertext so concurrent revoke or credential changes are not overwritten. A decryption error or update conflict stops the command; keep all old keys and resolve the cause before rerunning. Remove a retired key from the keyring only after the command completes successfully in every environment that stores connections.

If a key is lost or compromised, stop provider calls and preserve the database for audit. Credentials encrypted by a lost key cannot be recovered; coordinate provider-side credential rotation and reconnection with each account owner. Re-encryption does not revoke a compromised provider credential or erase copies an attacker may already hold.

## Release record

Record the environment, commit, migration command result, backup/PITR reference, migration verification result, preview pilot evidence, retention check, customer-route contract result, and operator/date. Exclude raw credentials, API keys, database URLs, and secret values.
