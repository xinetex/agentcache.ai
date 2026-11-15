import { randomUUID } from 'node:crypto';

const required = [
  'EXECUTION_PREVIEW_BASE_URL',
  'EXECUTION_PREVIEW_API_KEY',
  'EXECUTION_PREVIEW_APPROVER_API_KEY',
  'EXECUTION_PREVIEW_CONTEXT_PACK_ID',
  'EXECUTION_PREVIEW_CONNECTION_ID',
];

function fail(message, code = 1) {
  console.error(`Execution preview verification failed: ${message}`);
  process.exitCode = code;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(baseUrl, path, apiKey, { method = 'GET', body, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(path, baseUrl), {
      method,
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* The caller receives only a bounded status error. */ }
    return { status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function checkStatus(result, expected, label) {
  assert(result.status === expected, `${label} returned HTTP ${result.status}; expected ${expected}.`);
  assert(result.data && typeof result.data === 'object', `${label} returned an invalid response.`);
}

async function main() {
  const missing = required.filter((key) => !process.env[key]);
  assert(missing.length === 0, `set the required environment variables: ${missing.join(', ')}.`);
  assert(process.argv.includes('--confirm-preview'), 'pass --confirm-preview only after confirming the URL is an isolated Vercel Preview deployment.');

  const baseUrl = new URL(process.env.EXECUTION_PREVIEW_BASE_URL);
  assert(baseUrl.protocol === 'https:', 'the preview URL must use HTTPS.');
  assert(baseUrl.hostname.endsWith('.vercel.app'), 'the preview URL must be a Vercel deployment hostname, not a custom production domain.');
  baseUrl.pathname = '/';
  baseUrl.search = '';
  baseUrl.hash = '';
  const normalizedBaseUrl = baseUrl.toString();
  const apiKey = process.env.EXECUTION_PREVIEW_API_KEY;
  const approverKey = process.env.EXECUTION_PREVIEW_APPROVER_API_KEY;
  assert(apiKey !== approverKey, 'the run owner and approving administrator must use separate API keys.');

  console.log(`Checking isolated preview ${baseUrl.hostname}; secret values and provider results will not be printed.`);

  const catalog = await request(normalizedBaseUrl, '/api/execution/tools', apiKey);
  checkStatus(catalog, 200, 'Tool discovery');
  const tool = (catalog.data.tools || []).find((entry) => entry.name === 'jetty.storage.summary');
  assert(tool && tool.effect === 'read_only', 'the registered Jetty summary tool is missing or not marked read-only.');
  console.log('PASS tool discovery and read-only classification');

  const connections = await request(normalizedBaseUrl, '/api/execution/connections', apiKey);
  checkStatus(connections, 200, 'Connection listing');
  const connection = (connections.data.connections || []).find((entry) => entry.id === process.env.EXECUTION_PREVIEW_CONNECTION_ID);
  assert(connection, 'the configured connection is not owned by the run API key.');
  assert(connection.provider === 'jettythunder' && connection.status === 'active', 'the owned connection is not an active JettyThunder connection.');
  assert(connection.verificationStatus !== 'expired', 'the JettyThunder connection is marked expired.');
  assert((connection.scopes || []).some((scope) => scope === 'storage.read' || scope === 'metadata.read'), 'the owned connection lacks a declared read scope.');
  assert(!Object.keys(connection).some((key) => /credential|secret|token|password/i.test(key)), 'connection listing exposed a credential-like field.');
  console.log('PASS owned connection and secret-free listing');

  const contextPackPath = `/api/execution/context-packs/${encodeURIComponent(process.env.EXECUTION_PREVIEW_CONTEXT_PACK_ID)}`;
  const contextPackResult = await request(normalizedBaseUrl, contextPackPath, apiKey);
  checkStatus(contextPackResult, 200, 'Context pack lookup');
  const contextTools = contextPackResult.data.latestVersion?.tools || [];
  assert(contextTools.includes('jetty.storage.summary'), 'the selected context pack does not allow the Jetty summary tool.');
  console.log('PASS pilot context pack');

  const runResult = await request(normalizedBaseUrl, '/api/execution/runs', apiKey, {
    method: 'POST',
    body: {
      contextPackId: process.env.EXECUTION_PREVIEW_CONTEXT_PACK_ID,
      inputPayload: { purpose: 'preview_acceptance' },
      trigger: 'preview_acceptance',
      finalAction: 'manual',
      requireHumanGate: true,
    },
  });
  checkStatus(runResult, 201, 'Pilot run creation');
  const runId = runResult.data.run?.id;
  const gateId = runResult.data.gate?.id;
  assert(runId && gateId, 'the pilot run did not create its required human approval gate.');
  assert(runResult.data.gate.status === 'pending', 'the new approval gate is not pending.');
  console.log('PASS run created with pending approval gate');

  const approval = await request(normalizedBaseUrl, `/api/execution/gates/${encodeURIComponent(gateId)}/approve`, approverKey, {
    method: 'POST', body: { note: 'Preview acceptance read-only pilot.' },
  });
  checkStatus(approval, 200, 'Independent approval');
  assert(approval.data.gate?.status === 'approved', 'the independent approval was not recorded.');
  console.log('PASS approval recorded by separate API key');

  const invocationKey = randomUUID();
  const invocation = await request(normalizedBaseUrl, `/api/execution/runs/${encodeURIComponent(runId)}/invoke`, apiKey, {
    method: 'POST',
    body: {
      tool: 'jetty.storage.summary',
      connectionId: connection.id,
      idempotencyKey: invocationKey,
    },
    timeoutMs: 20_000,
  });
  checkStatus(invocation, 200, 'Approved Jetty summary');
  assert(invocation.data.success === true && invocation.data.invocation?.status === 'completed', 'the approved provider call did not complete.');
  const completedId = invocation.data.invocation.invocationId;
  assert(typeof completedId === 'string' && completedId.length > 0, 'the completed action has no invocation record ID.');
  console.log('PASS approved read-only Jetty action completed');

  const prohibited = await request(normalizedBaseUrl, `/api/execution/runs/${encodeURIComponent(runId)}/invoke`, apiKey, {
    method: 'POST',
    body: {
      tool: 'jetty.file.delete',
      connectionId: connection.id,
      idempotencyKey: randomUUID(),
    },
  });
  assert(prohibited.status === 403, `the prohibited action returned HTTP ${prohibited.status}; expected 403.`);
  console.log('PASS prohibited action denied');

  const history = await request(normalizedBaseUrl, `/api/execution/runs/${encodeURIComponent(runId)}/invocations`, apiKey);
  checkStatus(history, 200, 'Invocation history');
  const records = history.data.invocations || [];
  const completed = records.find((entry) => entry.id === completedId && entry.status === 'completed');
  const blocked = records.find((entry) => entry.toolName === 'unregistered_tool' && entry.status === 'blocked' && entry.errorCode === 'tool_not_allowlisted');
  assert(completed, 'execution history does not contain the completed provider action.');
  assert(blocked, 'execution history does not contain the prohibited action denial.');
  assert(!JSON.stringify(records).match(/(serviceKey|accessToken|refreshToken|password|fileName|filePath)/i), 'invocation history contains a forbidden secret or file-detail field.');
  console.log(`PASS durable history contains completed invocation ${completedId} and blocked action`);
  console.log('Preview acceptance succeeded. This run used one read-only provider action and created durable preview audit records.');
}

main().catch((error) => {
  // Print only intentional assertion messages; never print provider, HTTP response, or credential data.
  fail(error?.message || 'an unexpected error occurred.');
});
