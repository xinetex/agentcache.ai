import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WINDOW_MS_LIMIT = 366 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseBudgetEnv(env) {
  const base = env.AGENTCACHE_BASE_URL?.trim();
  const organizationId = env.PILOT_ORGANIZATION_ID?.trim();
  const adminToken = env.ADMIN_TOKEN?.trim();
  const actionLimit = Number(env.PILOT_ACTION_LIMIT);
  const periodStart = new Date(env.PILOT_ACTION_PERIOD_START || '');
  const periodEnd = new Date(env.PILOT_ACTION_PERIOD_END || '');

  if (!base || !organizationId || !adminToken || !env.PILOT_ACTION_LIMIT
    || !env.PILOT_ACTION_PERIOD_START || !env.PILOT_ACTION_PERIOD_END) {
    throw new Error('Set AGENTCACHE_BASE_URL, PILOT_ORGANIZATION_ID, PILOT_ACTION_LIMIT, PILOT_ACTION_PERIOD_START, PILOT_ACTION_PERIOD_END, and ADMIN_TOKEN in the secured operator environment.');
  }
  if (!UUID_PATTERN.test(organizationId)) throw new Error('PILOT_ORGANIZATION_ID must be a UUID.');
  let url;
  try { url = new URL(base); } catch { throw new Error('AGENTCACHE_BASE_URL must be a valid absolute URL.'); }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) throw new Error('Use HTTPS for the AgentCache base URL (HTTP is allowed only for loopback development).');
  if (url.username || url.password || url.search || url.hash) throw new Error('AGENTCACHE_BASE_URL must not contain credentials, query parameters, or a fragment.');
  if (!Number.isInteger(actionLimit) || actionLimit < 1 || actionLimit > 1_000_000) throw new Error('PILOT_ACTION_LIMIT must be an integer from 1 to 1,000,000.');
  if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime())
    || !env.PILOT_ACTION_PERIOD_START.endsWith('Z') || !env.PILOT_ACTION_PERIOD_END.endsWith('Z')
    || periodEnd <= periodStart || periodEnd - periodStart > WINDOW_MS_LIMIT) {
    throw new Error('Action-budget dates must be UTC ISO timestamps ending in Z, with a positive window no longer than 366 days.');
  }
  return {
    baseUrl: url.toString().replace(/\/$/, ''), organizationId, adminToken, actionLimit,
    periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(),
  };
}

async function requestJson(fetchImpl, url, adminToken, init) {
  const response = await fetchImpl(url, {
    ...init,
    headers: { 'X-Admin-Token': adminToken, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export async function configureExecutionActionBudget({ env = process.env, args = process.argv.slice(2), fetchImpl = fetch } = {}) {
  const unknownArgs = args.filter((arg) => !['--apply', '--new-window'].includes(arg));
  if (unknownArgs.length) throw new Error(`Unknown option: ${unknownArgs[0]}`);
  const config = parseBudgetEnv(env);
  const endpoint = `${config.baseUrl}/api/execution/admin/action-budgets/organization/${encodeURIComponent(config.organizationId)}`;
  const apply = args.includes('--apply');
  const allowNewWindow = args.includes('--new-window');
  const existing = await requestJson(fetchImpl, endpoint, config.adminToken);
  if (existing.status !== 200 && existing.status !== 404) {
    throw new Error(`Could not inspect the current action budget (HTTP ${existing.status}); no change was made.`);
  }
  if (existing.status === 200 && !existing.body?.budget) {
    throw new Error('The admin API returned an incomplete current budget record; no change was made.');
  }
  if (existing.status === 200 && existing.body?.budget) {
    const currentStart = new Date(existing.body.budget.periodStart).toISOString();
    const currentEnd = new Date(existing.body.budget.periodEnd).toISOString();
    const windowChanges = currentStart !== config.periodStart || currentEnd !== config.periodEnd;
    if (windowChanges && !allowNewWindow) {
      throw new Error('The requested window would reset the action counter. Review the current window, then add --new-window to confirm that reset.');
    }
  }

  if (!apply) {
    return {
      applied: false,
      message: 'Dry run: budget was inspected but not changed. Add --apply to configure it.',
      budget: { organizationId: config.organizationId, actionLimit: config.actionLimit, periodStart: config.periodStart, periodEnd: config.periodEnd },
    };
  }

  const payload = { actionLimit: config.actionLimit, periodStart: config.periodStart, periodEnd: config.periodEnd };
  const updated = await requestJson(fetchImpl, endpoint, config.adminToken, { method: 'PUT', body: JSON.stringify(payload) });
  if (updated.status !== 200) throw new Error(`Could not configure the action budget (HTTP ${updated.status}); verify the admin API response.`);
  const verified = await requestJson(fetchImpl, endpoint, config.adminToken);
  const budget = verified.body?.budget;
  if (verified.status !== 200 || !budget
    || Number(budget.actionLimit) !== config.actionLimit
    || new Date(budget.periodStart).toISOString() !== config.periodStart
    || new Date(budget.periodEnd).toISOString() !== config.periodEnd) {
    throw new Error('Action budget was written but read-back verification did not match. Do not enable the pilot until an administrator resolves this.');
  }
  return {
    applied: true,
    message: 'Action budget configured and verified. This is an attempt-count limit, not a dollar spend cap.',
    budget: { organizationId: config.organizationId, actionLimit: config.actionLimit, reservedCount: Number(budget.reservedCount), periodStart: config.periodStart, periodEnd: config.periodEnd },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  configureExecutionActionBudget().then((result) => {
    console.log(result.message);
    console.log(JSON.stringify(result.budget, null, 2));
  }).catch((error) => {
    console.error(`Action-budget configuration failed: ${error?.message || 'unknown_error'}`);
    process.exitCode = 1;
  });
}
