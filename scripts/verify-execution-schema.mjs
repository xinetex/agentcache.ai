import postgres from 'postgres';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_COLUMNS = Object.freeze({
  agent_connections: ['id', 'owner_principal_id', 'organization_id', 'provider', 'scopes', 'status', 'verification_status', 'encrypted_credentials', 'encryption_key_version', 'created_at', 'updated_at', 'last_used_at', 'revoked_at'],
  execution_invocations: ['id', 'execution_run_id', 'context_pack_version_id', 'run_receipt_id', 'approval_gate_id', 'approval_receipt_id', 'principal_id', 'actor_principal_id', 'organization_id', 'connection_id', 'tool_name', 'policy_version', 'policy_rule_ids', 'policy_reason_code', 'policy_score', 'idempotency_key_hash', 'request_hash', 'status', 'policy_decision', 'input_summary', 'result_summary', 'error_code', 'started_at', 'completed_at', 'created_at', 'expires_at'],
  execution_decision_events: ['id', 'event_type', 'execution_run_id', 'context_pack_id', 'context_pack_version_id', 'owner_principal_id', 'actor_principal_id', 'organization_id', 'actor_role', 'verdict', 'summary', 'findings', 'confidence', 'status', 'phase', 'receipt_id', 'occurred_at', 'expires_at'],
  execution_control_records: ['id', 'record_type', 'record_id', 'owner_principal_id', 'organization_id', 'payload', 'created_at', 'updated_at', 'expires_at', 'status'],
  execution_review_assignments: ['execution_run_id', 'reviewer_principal_id', 'reviewer_role', 'created_at', 'expires_at'],
  api_keys: ['organization_id', 'user_id', 'name', 'allowed_namespaces', 'key_prefix', 'key_hash', 'request_count', 'is_active', 'revoked_at'],
  organization_invitations: ['id', 'organization_id', 'email', 'role', 'token_hash', 'invited_by_user_id', 'expires_at', 'accepted_at', 'canceled_at', 'created_at'],
  execution_action_budgets: ['id', 'scope_type', 'scope_id', 'period_start', 'period_end', 'action_limit', 'reserved_count', 'configured_by', 'created_at', 'updated_at'],
  execution_action_reservations: ['id', 'budget_id', 'invocation_id', 'execution_run_id', 'created_at'],
});

export const REQUIRED_INDEXES = Object.freeze([
  'agent_connections_owner_status_idx',
  'execution_invocations_idempotency_unique',
  'execution_decision_events_run_idx',
  'execution_control_records_identity_idx',
  'execution_review_assignments_identity_pk',
  'organization_invitations_token_hash_key',
  'execution_action_budgets_scope_unique',
  'execution_action_reservations_invocation_unique',
]);

function configurationError(message) {
  return Object.assign(new Error(message), { code: 'execution_schema_configuration' });
}

export function compareExecutionSchema(columnRows, indexRows) {
  const actualColumns = new Map();
  for (const row of columnRows) {
    if (!actualColumns.has(row.table_name)) actualColumns.set(row.table_name, new Set());
    actualColumns.get(row.table_name).add(row.column_name);
  }
  const missing = [];
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const actual = actualColumns.get(table);
    if (!actual) {
      missing.push(`table ${table}`);
      continue;
    }
    for (const column of columns) if (!actual.has(column)) missing.push(`${table}.${column}`);
  }
  const actualIndexes = new Set(indexRows.map((row) => row.indexname));
  for (const index of REQUIRED_INDEXES) if (!actualIndexes.has(index)) missing.push(`index ${index}`);
  return { ready: missing.length === 0, missing };
}

export async function verifyExecutionSchema({ databaseUrl = process.env.DATABASE_URL, clientFactory = postgres } = {}) {
  if (!databaseUrl?.trim() || databaseUrl === 'mock' || /bogus/i.test(databaseUrl)) {
    throw configurationError('Set a reachable DATABASE_URL; mock database verification is not allowed.');
  }
  let url;
  try { url = new URL(databaseUrl); } catch { throw configurationError('DATABASE_URL is not a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw configurationError('DATABASE_URL must use the PostgreSQL protocol.');

  const client = clientFactory(databaseUrl, { prepare: false, ssl: 'require', connect_timeout: 5, idle_timeout: 5, max: 1 });
  try {
    const tableNames = Object.keys(REQUIRED_COLUMNS);
    const columns = await client.unsafe(
      'SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = ANY(current_schemas(false)) AND table_name = ANY($1::text[])',
      [tableNames],
    );
    const indexes = await client.unsafe(
      'SELECT indexname FROM pg_indexes WHERE schemaname = ANY(current_schemas(false)) AND indexname = ANY($1::text[])',
      [REQUIRED_INDEXES],
    );
    return compareExecutionSchema(columns, indexes);
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  verifyExecutionSchema().then((result) => {
    if (result.ready) console.log('Execution schema verified: required tables, columns, and safety indexes are present.');
    else {
      console.error('Execution schema is incomplete:');
      result.missing.forEach((item) => console.error(`- ${item}`));
      process.exitCode = 1;
    }
  }).catch((error) => {
    const detail = error?.code === 'execution_schema_configuration'
      ? error.message
      : `database connection failed (${error?.code || 'unknown_error'})`;
    console.error(`Execution schema verification failed: ${detail}`);
    process.exitCode = 1;
  });
}
