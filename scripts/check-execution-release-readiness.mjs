import { existsSync, readFileSync } from 'node:fs';

const checks = [];
const add = (name, ready, detail) => checks.push({ name, ready, detail });

add('DATABASE_URL', Boolean(process.env.DATABASE_URL?.trim()), 'Present in the process or loaded local files; configure the deployment environment separately');
add('CRON_SECRET', Boolean(process.env.CRON_SECRET?.trim()), 'Required to protect execution retention');
add('ADMIN_TOKEN', Boolean(process.env.ADMIN_TOKEN?.trim()), 'Required for operator provisioning and action-budget administration');

const currentVersion = process.env.AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY_VERSION?.trim() || 'v1';
let keyring = {};
try {
  keyring = JSON.parse(process.env.AGENTCACHE_CONNECTIONS_ENCRYPTION_KEYRING || '{}');
} catch {
  keyring = null;
}
const activeKey = process.env.AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY?.trim();
const decodedLength = (value) => {
  if (!value) return 0;
  if (/^[0-9a-f]{64}$/i.test(value)) return 32;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 === 1) return 0;
  try {
    const decoded = Buffer.from(value, 'base64');
    const canonical = decoded.toString('base64');
    return value === canonical || value === canonical.replace(/=+$/, '') ? decoded.length : 0;
  } catch { return 0; }
};
const keyringReady = keyring !== null && Object.entries(keyring).every(([version, value]) =>
  /^[a-zA-Z0-9_-]{1,16}$/.test(version) && decodedLength(value) === 32);
const keyReady = decodedLength(activeKey) === 32 && /^[a-zA-Z0-9_-]{1,16}$/.test(currentVersion) && keyringReady;
add('Connection encryption key', keyReady, 'Active and retained keys must be 32 bytes (hex or base64); key values are never displayed');

const retentionRaw = process.env.AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS;
const retention = retentionRaw === undefined ? 365 : Number(retentionRaw);
add('Audit retention', Number.isInteger(retention) && retention >= 90 && retention <= 2555,
  'Set 90–2555 days (defaults to 365)');

const migrations = [
  '0005_agent_connections.sql',
  '0006_execution_invocations.sql',
  '0007_execution_invocation_receipts.sql',
  '0008_execution_decision_events.sql',
  '0009_execution_invocation_approval_links.sql',
  '0010_execution_control_records.sql',
  '0011_execution_record_retention.sql',
  '0012_execution_review_assignments.sql',
  '0013_execution_invocation_idempotency.sql',
  '0014_execution_invocation_policy_evidence.sql',
  '0015_execution_invocation_actor.sql',
  '0016_execution_gate_compare_and_set.sql',
  '0017_individual_api_keys.sql',
  '0018_organization_invitations.sql',
  '0019_execution_action_budgets.sql',
];
const missingMigrations = migrations.filter((name) => !existsSync(`drizzle/${name}`));
add('Execution migrations', missingMigrations.length === 0,
  missingMigrations.length ? `Missing: ${missingMigrations.join(', ')}` : 'Files 0005–0019 are present; database application must be verified separately');

let migrationJournal;
try { migrationJournal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')); } catch { migrationJournal = null; }
const recordedMigrationTags = new Set((migrationJournal?.entries || []).map((entry) => entry.tag));
const missingJournalEntries = migrations
  .map((name) => name.replace(/\.sql$/i, ''))
  .filter((tag) => !recordedMigrationTags.has(tag));
add('Execution migrations registered', missingJournalEntries.length === 0,
  missingJournalEntries.length ? `Missing journal entries: ${missingJournalEntries.join(', ')}` : 'Files 0005–0019 are registered in the Drizzle journal');
let packageScripts;
try { packageScripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts; } catch { packageScripts = {}; }
add('Migration runner', packageScripts?.['db:migrate'] === 'drizzle-kit migrate',
  packageScripts?.['db:migrate'] === 'drizzle-kit migrate' ? 'Run npm run db:migrate against the target DATABASE_URL' : 'Add a Drizzle migration runner before deployment');
const schemaVerifierReady = packageScripts?.['execution:verify-schema'] === 'node ./scripts/verify-execution-schema.mjs'
  && existsSync('scripts/verify-execution-schema.mjs');
add('Database schema verifier', schemaVerifierReady,
  schemaVerifierReady ? 'Read-only verification of required execution tables, columns, and safety indexes is available' : 'Add a read-only verifier for the migrated execution schema');
const keyRotationRunnerReady = packageScripts?.['execution:rotate-connection-keys'] === 'node --import tsx ./scripts/rotate-execution-connection-keys.ts'
  && existsSync('scripts/rotate-execution-connection-keys.ts');
add('Connection-key rotation runner', keyRotationRunnerReady,
  keyRotationRunnerReady ? 'Bounded re-encryption is available; operational exercise is still required' : 'Add and verify a connection-key re-encryption runner');
const actionBudgetRunnerReady = packageScripts?.['execution:configure-action-budget'] === 'node ./scripts/configure-execution-action-budget.mjs'
  && existsSync('scripts/configure-execution-action-budget.mjs');
add('Pilot action-budget runner', actionBudgetRunnerReady,
  actionBudgetRunnerReady ? 'Dry-run, apply, and read-back verification are available; configure the target organization before enabling provider calls' : 'Add a safe operator path to configure and verify the pilot action budget');

let vercelConfig;
try { vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8')); } catch { vercelConfig = {}; }
const retentionCron = vercelConfig.crons?.find((cron) => cron.path === '/api/cron/execution-retention');
add('Retention schedule', Boolean(retentionCron && typeof retentionCron.schedule === 'string' && retentionCron.schedule.trim()),
  'Vercel cron must target /api/cron/execution-retention with a schedule');
let retentionHandler = '';
try { retentionHandler = readFileSync('api/cron/execution-retention.ts', 'utf8'); } catch { /* reported below */ }
const retentionIsProtected = retentionHandler.includes('process.env.CRON_SECRET') && retentionHandler.includes('req.headers.authorization');
add('Retention endpoint protection', retentionIsProtected,
  retentionIsProtected ? 'Handler checks the CRON_SECRET bearer authorization header' : 'Execution retention handler must enforce CRON_SECRET bearer authorization');

console.log('AgentCache governed execution release preflight');
console.log('Local runs load .env and .env.local; readiness here does not confirm Vercel settings or database reachability.');
for (const check of checks) console.log(`${check.ready ? 'READY' : 'NEEDS ACTION'}  ${check.name} — ${check.detail}`);
console.log('MANUAL  Resolve the Terms/Privacy retention mismatch with the approved reviewer, configure and verify the pilot action budget, exercise key recovery, test user-owned Jetty credentials, and verify customer-critical route contracts in Vercel preview. See docs/strategy/EXECUTION_DATA_OPERATIONS.md.');
if (checks.some((check) => !check.ready)) process.exitCode = 1;
