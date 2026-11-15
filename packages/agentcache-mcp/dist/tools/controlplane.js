/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 */
const AGENTCACHE_API_URL = process.env.AGENTCACHE_API_URL || 'https://agentcache.ai';
async function callApi(endpoint, method, body, apiKey, extraHeaders = {}) {
    const key = apiKey || process.env.AGENTCACHE_API_KEY || process.env.API_KEY || '';
    if (!key.startsWith('ac_'))
        throw new Error('Set AGENTCACHE_API_KEY to a valid AgentCache API key before calling this tool.');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'X-API-Key': key,
        ...extraHeaders,
    };
    const options = { method, headers };
    if (body && method !== 'GET')
        options.body = JSON.stringify(body);
    const res = await fetch(`${AGENTCACHE_API_URL}${endpoint}`, options);
    const data = (await res.json().catch(() => ({})));
    if (!res.ok)
        throw new Error(`AgentCache API error: ${data.error || res.statusText}`);
    return data;
}
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
export const ControlPlaneTools = {
    tools: [
        {
            name: 'agentcache_execution_tools',
            description: 'Discover the governed execution tools available to this AgentCache API key, including required inputs and approval behavior.',
            inputSchema: { type: 'object', properties: {} },
        },
        {
            name: 'agentcache_execution_context_packs',
            description: 'List workflow context packs owned by this API key. Packs define the objective, allowed tools, policy profile, and review phases for governed runs.',
            inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        },
        {
            name: 'agentcache_execution_create_context_pack',
            description: 'Create an owned, versioned workflow definition. Discovery does not grant connection access; each run still applies policy, scope, and approval checks.',
            inputSchema: { type: 'object', properties: {
                    name: { type: 'string' }, objective: { type: 'string' }, sectorHint: { type: 'string' },
                    workflowTemplate: { type: 'string', enum: ['generic', 'policy_review', 'regulated_release', 'research_brief'] },
                    tools: { type: 'array', items: { type: 'string' } }, policyProfile: { type: 'object' },
                    workflowPhases: { type: 'array', items: { type: 'string' } }, reviewerRoles: { type: 'array', items: { type: 'string' } },
                }, required: ['name', 'objective'] },
        },
        {
            name: 'agentcache_execution_context_pack',
            description: 'Read one workflow context pack owned by this API key.',
            inputSchema: { type: 'object', properties: { contextPackId: { type: 'string' } }, required: ['contextPackId'] },
        },
        {
            name: 'agentcache_execution_connections',
            description: 'List owned provider connection metadata. Credential values are never returned.',
            inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        },
        {
            name: 'agentcache_execution_connect',
            description: 'Save credentials for a provider account you own. Requires a user or organization AgentCache API key. Credentials are encrypted at rest; requested scopes are not proof of provider authorization.',
            inputSchema: { type: 'object', properties: {
                    provider: { type: 'string' }, displayName: { type: 'string' },
                    scopes: { type: 'array', items: { type: 'string' } }, credentials: { type: 'object' },
                }, required: ['provider', 'credentials'] },
        },
        {
            name: 'agentcache_execution_disconnect',
            description: 'Revoke a provider connection owned by this user or organization API key and clear its encrypted credential material.',
            inputSchema: { type: 'object', properties: { connectionId: { type: 'string' } }, required: ['connectionId'] },
        },
        {
            name: 'agentcache_execution_start',
            description: 'Start a policy-checked workflow run. Starting a run does not call a provider; configured review and human gates must be cleared before invocation.',
            inputSchema: { type: 'object', properties: {
                    contextPackId: { type: 'string' }, contextPackVersionId: { type: 'string' }, inputPayload: { type: 'object' },
                    trigger: { type: 'string' }, finalAction: { type: 'string', enum: ['publish', 'send', 'pay', 'delete', 'external_store', 'manual'] },
                    requireHumanGate: { type: 'boolean' },
                }, required: ['contextPackId'] },
        },
        {
            name: 'agentcache_execution_status',
            description: 'Read the run, review, approval gate, and receipt history for an owned workflow.',
            inputSchema: { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'] },
        },
        {
            name: 'agentcache_execution_advance_phase',
            description: 'Advance an owned run to a configured phase. This can submit a run to its gate, but this MCP client does not expose gate decisions. A different owner or admin member of the same organization must approve or reject it through the API.',
            inputSchema: { type: 'object', properties: { runId: { type: 'string' }, phase: { type: 'string' } }, required: ['runId', 'phase'] },
        },
        {
            name: 'agentcache_execution_invoke_jetty_summary',
            description: 'Invoke the policy-checked, read-only Jetty storage summary through an owned connection. Returns aggregate quota and file count only. Reuse the same idempotency key for retries; inspect history before retrying an incomplete call.',
            inputSchema: { type: 'object', properties: {
                    runId: { type: 'string' }, connectionId: { type: 'string' }, idempotencyKey: { type: 'string', minLength: 16, maxLength: 128 },
                }, required: ['runId', 'connectionId'] },
        },
        {
            name: 'agentcache_execution_invocations',
            description: 'Read durable, redacted invocation records for an owned run, including incomplete calls and sanitized outcomes.',
            inputSchema: { type: 'object', properties: { runId: { type: 'string' }, limit: { type: 'number' } }, required: ['runId'] },
        },
        {
            name: 'agentcache_execution_invocation_history',
            description: 'Read recent durable, redacted invocation records owned by this AgentCache API key.',
            inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        },
        {
            name: 'agentcache_execution_decision_history',
            description: 'Read durable run, review, phase, and approval decision metadata owned by this API key. The ledger excludes workflow payloads.',
            inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        },
        {
            name: 'agentcache_execution_usage',
            description: 'Read completed, blocked, failed, and incomplete governed-action counts for pilot measurement. This tool does not charge.',
            inputSchema: { type: 'object', properties: {} },
        },
        {
            name: 'agentcache_savings',
            description: 'Report modeled cache savings for the organization over a window (default 30 days), with ROI and a breakdown by cache layer and model. The calculation uses recorded savings events, configured or default model rates, and a plan-price assumption; it is not reconciled to provider invoices. Treat it as an estimate and compare with billing records.',
            inputSchema: {
                type: 'object',
                properties: {
                    days: { type: 'number', description: 'Look-back window in days (1–365, default 30)' },
                },
            },
        },
        {
            name: 'agentcache_gate',
            description: 'BEFORE making an expensive model call, ask whether it is allowed under this account\'s spend budget, request quota, anomaly guard, and kill-switch. Returns { allow, severity, estCostUsd, reasons }. A well-behaved agent calls this first and does not proceed when allow is false — this is how an autonomous agent avoids burning a budget overnight. Deny is a normal governed outcome, not an error.',
            inputSchema: {
                type: 'object',
                properties: {
                    model: { type: 'string', description: 'Model the call would use (e.g. claude-opus-5, gpt-5.2)' },
                    inputTokens: { type: 'number', description: 'Estimated input tokens for the proposed call' },
                    outputTokens: { type: 'number', description: 'Estimated output tokens for the proposed call' },
                },
                required: ['model'],
            },
        },
        {
            name: 'agentcache_reasoning_resume',
            description: 'Resume prior reasoning for a recurring task. Given an agentId and a task (string or object), returns the bounded state this agent accumulated on that task in earlier runs — facts, decisions, and scratch — so the agent starts where it left off instead of re-deriving everything. Call at the start of a task; pass an optional query to bias what is carried.',
            inputSchema: {
                type: 'object',
                properties: {
                    agentId: { type: 'string', description: 'Stable identifier for this agent/role' },
                    task: { description: 'The task key — a string or JSON object; hashed stably so the same task resumes' },
                    namespace: { type: 'string', description: 'Cache namespace (multi-tenant scope). Default: "default"' },
                    query: { type: 'string', description: 'Optional focus to rank which prior facts are carried' },
                    maxChars: { type: 'number', description: 'Optional cap on carried context size (default 6000)' },
                },
                required: ['agentId', 'task'],
            },
        },
        {
            name: 'agentcache_reasoning_commit',
            description: 'Persist what this run learned so the NEXT run of the same task can resume it. Merges a delta of { facts?, decisions?, scratch? } into the stored state (facts/decisions are appended and de-duplicated). Call at the end of a task, or after any durable conclusion worth keeping across runs.',
            inputSchema: {
                type: 'object',
                properties: {
                    agentId: { type: 'string', description: 'Stable identifier for this agent/role' },
                    task: { description: 'The task key — must match the one used on resume' },
                    namespace: { type: 'string', description: 'Cache namespace. Default: "default"' },
                    delta: {
                        type: 'object',
                        description: 'What to remember',
                        properties: {
                            facts: { type: 'array', items: { type: 'string' } },
                            decisions: { type: 'array', items: { type: 'string' } },
                            scratch: { type: 'object' },
                        },
                    },
                },
                required: ['agentId', 'task', 'delta'],
            },
        },
    ],
    handlers: {
        agentcache_execution_tools: async (_args, context) => ok(await callApi('/api/execution/tools', 'GET', null, context.apiKey)),
        agentcache_execution_context_packs: async (args, context) => {
            const limit = Math.min(Math.max(Number(args?.limit) || 25, 1), 100);
            return ok(await callApi(`/api/execution/context-packs?limit=${limit}`, 'GET', null, context.apiKey));
        },
        agentcache_execution_create_context_pack: async (args, context) => ok(await callApi('/api/execution/context-packs', 'POST', args, context.apiKey)),
        agentcache_execution_context_pack: async (args, context) => {
            const id = encodeURIComponent(String(args?.contextPackId || ''));
            return ok(await callApi(`/api/execution/context-packs/${id}`, 'GET', null, context.apiKey));
        },
        agentcache_execution_connections: async (args, context) => {
            const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
            return ok(await callApi(`/api/execution/connections?limit=${limit}`, 'GET', null, context.apiKey));
        },
        agentcache_execution_connect: async (args, context) => ok(await callApi('/api/execution/connections', 'POST', args, context.apiKey)),
        agentcache_execution_disconnect: async (args, context) => {
            const id = encodeURIComponent(String(args?.connectionId || ''));
            return ok(await callApi(`/api/execution/connections/${id}`, 'DELETE', null, context.apiKey));
        },
        agentcache_execution_start: async (args, context) => ok(await callApi('/api/execution/runs', 'POST', args, context.apiKey)),
        agentcache_execution_status: async (args, context) => {
            const id = encodeURIComponent(String(args?.runId || ''));
            return ok(await callApi(`/api/execution/runs/${id}`, 'GET', null, context.apiKey));
        },
        agentcache_execution_advance_phase: async (args, context) => {
            const id = encodeURIComponent(String(args?.runId || ''));
            return ok(await callApi(`/api/execution/runs/${id}/phase`, 'POST', { phase: args?.phase }, context.apiKey));
        },
        agentcache_execution_invoke_jetty_summary: async (args, context) => {
            const id = encodeURIComponent(String(args?.runId || ''));
            return ok(await callApi(`/api/execution/runs/${id}/invoke`, 'POST', {
                tool: 'jetty.storage.summary', connectionId: args?.connectionId, idempotencyKey: args?.idempotencyKey,
            }, context.apiKey));
        },
        agentcache_execution_invocations: async (args, context) => {
            const id = encodeURIComponent(String(args?.runId || ''));
            const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
            return ok(await callApi(`/api/execution/runs/${id}/invocations?limit=${limit}`, 'GET', null, context.apiKey));
        },
        agentcache_execution_invocation_history: async (args, context) => {
            const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
            return ok(await callApi(`/api/execution/invocations?limit=${limit}`, 'GET', null, context.apiKey));
        },
        agentcache_execution_decision_history: async (args, context) => {
            const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
            return ok(await callApi(`/api/execution/decision-events?limit=${limit}`, 'GET', null, context.apiKey));
        },
        agentcache_execution_usage: async (_args, context) => ok(await callApi('/api/execution/usage', 'GET', null, context.apiKey)),
        agentcache_savings: async (args, context) => {
            const days = Math.min(Math.max(Number(args?.days) || 30, 1), 365);
            const data = await callApi(`/api/analytics/savings?days=${days}`, 'GET', null, context.apiKey);
            return ok({
                summary: `Modeled net savings: $${data.netSavedUsd} over ${data.windowDays}d${data.roi ? ` · ${data.roi}× modeled ROI` : ''}`,
                ...data,
            });
        },
        agentcache_gate: async (args, context) => {
            const body = {
                model: args?.model || 'unknown',
                inputTokens: Number(args?.inputTokens) || 0,
                outputTokens: Number(args?.outputTokens) || 0,
            };
            const data = await callApi('/api/governance/gate', 'POST', body, context.apiKey);
            return ok({
                verdict: data.allow ? (data.severity === 'warn' ? 'ALLOW (warning)' : 'ALLOW') : 'BLOCK — do not proceed',
                ...data,
            });
        },
        agentcache_reasoning_resume: async (args, context) => {
            const ns = args?.namespace || 'default';
            const body = { action: 'resume', agentId: args?.agentId, task: args?.task, query: args?.query, maxChars: args?.maxChars };
            const data = await callApi('/api/cache/reasoning', 'POST', body, context.apiKey, { 'X-Cache-Namespace': ns });
            return ok(data);
        },
        agentcache_reasoning_commit: async (args, context) => {
            const ns = args?.namespace || 'default';
            const body = { action: 'commit', agentId: args?.agentId, task: args?.task, delta: args?.delta || {} };
            const data = await callApi('/api/cache/reasoning', 'POST', body, context.apiKey, { 'X-Cache-Namespace': ns });
            return ok(data);
        },
    },
};
