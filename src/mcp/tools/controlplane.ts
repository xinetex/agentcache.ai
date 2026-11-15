/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 */

/**
 * AgentCache MCP — Governed execution and legacy simulation tools.
 *
 * Exposes AgentCache's governed execution workflow alongside caching, memory,
 * and supporting control-plane capabilities.
 */

import { ToolModule, ToolHandlerContext } from '../registry.js';
import { getAgentCacheApiKey } from '../config.js';

const AGENTCACHE_API_URL = process.env.AGENTCACHE_API_URL || 'https://agentcache.ai';

async function callApi(
  endpoint: string,
  method: string,
  body: any,
  apiKey: string | undefined,
  extraHeaders: Record<string, string> = {},
): Promise<any> {
  const key = getAgentCacheApiKey(apiKey);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
    'X-API-Key': key,
    ...extraHeaders,
  };
  const options: RequestInit = { method, headers };
  if (body && method !== 'GET') options.body = JSON.stringify(body);
  const res = await fetch(`${AGENTCACHE_API_URL}${endpoint}`, options);
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`AgentCache API error: ${data.error || res.statusText}`);
  return data;
}

const ok = (obj: any) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

export const ControlPlaneTools: ToolModule = {
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
      description: 'Create an owned, versioned workflow definition. Tool discovery does not grant connection access; each run still applies policy, consent, and approval checks.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          objective: { type: 'string' },
          sectorHint: { type: 'string' },
          workflowTemplate: { type: 'string', enum: ['generic', 'policy_review', 'regulated_release', 'research_brief'] },
          tools: { type: 'array', items: { type: 'string' } },
          policyProfile: { type: 'object' },
          workflowPhases: { type: 'array', items: { type: 'string' } },
          reviewerRoles: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'objective'],
      },
    },
    {
      name: 'agentcache_execution_context_pack',
      description: 'Read one workflow context pack and its current version, if it is owned by this API key.',
      inputSchema: { type: 'object', properties: { contextPackId: { type: 'string' } }, required: ['contextPackId'] },
    },
    {
      name: 'agentcache_execution_connections',
      description: 'List provider connection metadata owned by the configured API key. Credential values are never returned.',
      inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    },
    {
      name: 'agentcache_execution_connect',
      description: 'Save credentials for a provider account you own. Requires a user or organization AgentCache API key; the credential payload is encrypted at rest and requested scopes remain unverified until an adapter checks them.',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string' },
          displayName: { type: 'string' },
          scopes: { type: 'array', items: { type: 'string' } },
          credentials: { type: 'object' },
        },
        required: ['provider', 'credentials'],
      },
    },
    {
      name: 'agentcache_execution_disconnect',
      description: 'Disconnect a provider account owned by this user or organization API key and remove its encrypted credential material.',
      inputSchema: { type: 'object', properties: { connectionId: { type: 'string' } }, required: ['connectionId'] },
    },
    {
      name: 'agentcache_execution_start',
      description: 'Start a workflow run using a context pack. The run is policy checked and high impact actions may pause for human approval.',
      inputSchema: {
        type: 'object',
        properties: {
          contextPackId: { type: 'string' },
          contextPackVersionId: { type: 'string' },
          inputPayload: { type: 'object' },
          trigger: { type: 'string' },
          finalAction: { type: 'string', enum: ['publish', 'send', 'pay', 'delete', 'external_store', 'manual'] },
          requireHumanGate: { type: 'boolean' },
        },
        required: ['contextPackId'],
      },
    },
    {
      name: 'agentcache_execution_status',
      description: 'Read the run, review, approval gate, and receipt history for a governed workflow execution.',
      inputSchema: {
        type: 'object',
        properties: { runId: { type: 'string' } },
        required: ['runId'],
      },
    },
    {
      name: 'agentcache_execution_advance_phase',
      description: 'Advance an owned run to a configured workflow phase. This can submit a run to its gate, but this MCP client does not expose gate decisions. The API requires a different owner or admin member of the same organization to approve or reject it.',
      inputSchema: {
        type: 'object',
        properties: { runId: { type: 'string' }, phase: { type: 'string' } },
        required: ['runId', 'phase'],
      },
    },
    {
      name: 'agentcache_execution_invoke_jetty_summary',
      description: 'Run the policy-checked JettyThunder storage summary tool for an owned run using an owned read-only service connection. Returns aggregate quota and file count only. Reuse the same optional idempotencyKey when retrying; without one, the run/account action is single-shot.',
      inputSchema: { type: 'object', properties: { runId: { type: 'string' }, connectionId: { type: 'string' }, idempotencyKey: { type: 'string', minLength: 16, maxLength: 128 } }, required: ['runId', 'connectionId'] },
    },
    {
      name: 'agentcache_execution_invocations',
      description: 'Read durable, redacted invocation records for an owned run, including incomplete calls and sanitized outcomes.',
      inputSchema: { type: 'object', properties: { runId: { type: 'string' }, limit: { type: 'number' } }, required: ['runId'] },
    },
    {
      name: 'agentcache_execution_invocation_history',
      description: 'Read recent durable, redacted tool invocation records owned by the configured AgentCache API key.',
      inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    },
    {
      name: 'agentcache_execution_decision_history',
      description: 'Read durable run, review, phase, and approval decision metadata owned by the configured AgentCache API key. The ledger excludes workflow payloads.',
      inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    },
    {
      name: 'agentcache_execution_usage',
      description: 'Read governed-action usage counts for pilot measurement. Completed actions are the only potential billable units; this tool does not charge.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'agentcache_execution_evaluate',
      description: 'Evaluate a governed run for drift in shadow mode; the action is policy checked and recorded.',
      inputSchema: {
        type: 'object',
        properties: { runId: { type: 'string' }, mode: { type: 'string', enum: ['shadow'] } },
        required: ['runId'],
      },
    },
    {
      name: 'agentcache_savings',
      description:
        'Report modeled cache savings for the organization over a window (default 30 days), with ROI and a breakdown by cache layer and model. The calculation uses recorded savings events, configured or default model rates, and a plan-price assumption; it is not reconciled to provider invoices. Treat it as an estimate and compare with billing records.',
      inputSchema: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Look-back window in days (1–365, default 30)' },
        },
      },
    },
    {
      name: 'agentcache_gate',
      description:
        'BEFORE making an expensive model call, ask whether it is allowed under this account\'s spend budget, request quota, anomaly guard, and kill-switch. Returns { allow, severity, estCostUsd, reasons }. A well-behaved agent calls this first and does not proceed when allow is false — this is how an autonomous agent avoids burning a budget overnight. Deny is a normal governed outcome, not an error.',
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
      description:
        'Resume prior reasoning for a recurring task. Given an agentId and a task (string or object), returns the bounded state this agent accumulated on that task in earlier runs — facts, decisions, and scratch — so the agent starts where it left off instead of re-deriving everything. Call at the start of a task; pass an optional query to bias what is carried.',
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
      description:
        'Persist what this run learned so the NEXT run of the same task can resume it. Merges a delta of { facts?, decisions?, scratch? } into the stored state (facts/decisions are appended and de-duplicated). Call at the end of a task, or after any durable conclusion worth keeping across runs.',
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
    {
      name: 'agentcache_run_dispatch',
      description:
        'Legacy planning simulation only. Evaluates caller-declared model/token cost estimates against policy and can run built-in sandbox helpers (echo, calculator, JSON transform, noop). It does not call LLM providers or external tools; spend and savings are estimates, not provider-billed or independently verified amounts. Use the governed execution tools for provider actions.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Identifier for this planning simulation' },
          goal: { type: 'string', description: 'High-level task description or objective' },
          namespace: { type: 'string', description: 'Tenant namespace. Default: "default"' },
          approvalThresholdUsd: { type: 'number', description: 'Estimated dollar limit per step that pauses this simulation for human approval' },
          steps: {
            type: 'array',
            description: 'Pre-planned simulation steps. Any model, token, cache-layer, or savings fields are caller-declared estimates. toolCall supports only built-in sandbox helpers; it does not call external tools.',
            items: { type: 'object' },
          },
        },
        required: ['agentId'],
      },
    },
    {
      name: 'agentcache_run_status',
      description:
        'Queries a legacy planning simulation. The API labels its mode and says provider calls are disabled. Spend and per-run savings derive from caller-declared fields; they are not written to organization-wide savings analytics or verified against provider billing.',
      inputSchema: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The unique run ID returned by dispatch' },
        },
        required: ['runId'],
      },
    },
    {
      name: 'agentcache_run_approve',
      description:
        'Approves or rejects a planning simulation step currently paused for its estimated budget threshold or declared approval requirement.',
      inputSchema: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The paused run ID' },
          decision: { type: 'string', enum: ['approve', 'reject'], description: 'Whether to resume or kill the task' },
          note: { type: 'string', description: 'Optional explanation or supervisor guidance' },
        },
        required: ['runId', 'decision'],
      },
    },
    {
      name: 'agentcache_run_cancel',
      description:
        'Cancel an active legacy planning simulation. This does not cancel provider or external tool calls because this mode does not make them.',
      inputSchema: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The run ID to cancel' },
          reason: { type: 'string', description: 'Optional reason for cancellation' },
        },
        required: ['runId'],
      },
    },
    {
      name: 'agentcache_linguistic_scan',
      description:
        'Scans an agent transcript, message, or scratchpad for synthetic non-human language (Glossogen argots, case signaling, and covert ZZ-style channels). Returns Shannon entropy and security posture (nominal, warn, block).',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The message or transcript to evaluate' },
        },
        required: ['text'],
      },
    },
    {
      name: 'agentcache_rosetta_decompile',
      description:
        'Decompiles a synthetic argot or shorthand message into human-readable plain English using the Rosetta Codebook.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The shorthand or argot text to decompile' },
        },
        required: ['text'],
      },
    },
  ],

  handlers: {
    agentcache_execution_tools: async (_args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/execution/tools', 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_context_packs: async (args: any, context: ToolHandlerContext) => {
      const limit = Math.min(Math.max(Number(args?.limit) || 25, 1), 100);
      const data = await callApi(`/api/execution/context-packs?limit=${limit}`, 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_create_context_pack: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/execution/context-packs', 'POST', args, context.apiKey);
      return ok(data);
    },

    agentcache_execution_context_pack: async (args: any, context: ToolHandlerContext) => {
      const contextPackId = encodeURIComponent(String(args?.contextPackId || ''));
      const data = await callApi(`/api/execution/context-packs/${contextPackId}`, 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_connections: async (args: any, context: ToolHandlerContext) => {
      const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
      const data = await callApi(`/api/execution/connections?limit=${limit}`, 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_connect: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/execution/connections', 'POST', args, context.apiKey);
      return ok(data);
    },

    agentcache_execution_disconnect: async (args: any, context: ToolHandlerContext) => {
      const id = encodeURIComponent(String(args?.connectionId || ''));
      const data = await callApi(`/api/execution/connections/${id}`, 'DELETE', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_start: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/execution/runs', 'POST', args, context.apiKey);
      return ok(data);
    },

    agentcache_execution_status: async (args: any, context: ToolHandlerContext) => {
      const runId = encodeURIComponent(String(args?.runId || ''));
      const data = await callApi(`/api/execution/runs/${runId}`, 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_advance_phase: async (args: any, context: ToolHandlerContext) => {
      const runId = encodeURIComponent(String(args?.runId || ''));
      const data = await callApi(`/api/execution/runs/${runId}/phase`, 'POST', { phase: args?.phase }, context.apiKey);
      return ok(data);
    },

    agentcache_execution_invoke_jetty_summary: async (args: any, context: ToolHandlerContext) => {
      const runId = encodeURIComponent(String(args?.runId || ''));
      const data = await callApi(`/api/execution/runs/${runId}/invoke`, 'POST', { tool: 'jetty.storage.summary', connectionId: args?.connectionId, idempotencyKey: args?.idempotencyKey }, context.apiKey);
      return ok(data);
    },

    agentcache_execution_invocations: async (args: any, context: ToolHandlerContext) => {
      const runId = encodeURIComponent(String(args?.runId || ''));
      const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
      const data = await callApi(`/api/execution/runs/${runId}/invocations?limit=${limit}`, 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_invocation_history: async (args: any, context: ToolHandlerContext) => {
      const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
      const data = await callApi(`/api/execution/invocations?limit=${limit}`, 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_decision_history: async (args: any, context: ToolHandlerContext) => {
      const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
      const data = await callApi(`/api/execution/decision-events?limit=${limit}`, 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_usage: async (_args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/execution/usage', 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_execution_evaluate: async (args: any, context: ToolHandlerContext) => {
      const runId = encodeURIComponent(String(args?.runId || ''));
      const data = await callApi(`/api/execution/runs/${runId}/evaluate`, 'POST', { mode: args?.mode || 'shadow' }, context.apiKey);
      return ok(data);
    },

    agentcache_savings: async (args: any, context: ToolHandlerContext) => {
      const days = Math.min(Math.max(Number(args?.days) || 30, 1), 365);
      const data = await callApi(`/api/analytics/savings?days=${days}`, 'GET', null, context.apiKey);
      return ok({
        summary: `Modeled net savings: $${data.netSavedUsd} over ${data.windowDays}d${data.roi ? ` · ${data.roi}× modeled ROI` : ''}`,
        ...data,
      });
    },

    agentcache_gate: async (args: any, context: ToolHandlerContext) => {
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

    agentcache_reasoning_resume: async (args: any, context: ToolHandlerContext) => {
      const ns = args?.namespace || 'default';
      const body = { action: 'resume', agentId: args?.agentId, task: args?.task, query: args?.query, maxChars: args?.maxChars };
      const data = await callApi('/api/cache/reasoning', 'POST', body, context.apiKey, { 'X-Cache-Namespace': ns });
      return ok(data);
    },

    agentcache_reasoning_commit: async (args: any, context: ToolHandlerContext) => {
      const ns = args?.namespace || 'default';
      const body = { action: 'commit', agentId: args?.agentId, task: args?.task, delta: args?.delta || {} };
      const data = await callApi('/api/cache/reasoning', 'POST', body, context.apiKey, { 'X-Cache-Namespace': ns });
      return ok(data);
    },

    agentcache_run_dispatch: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/agent/dispatch', 'POST', args, context.apiKey);
      return ok(data);
    },

    agentcache_run_status: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi(`/api/agent/run/${encodeURIComponent(args?.runId)}`, 'GET', null, context.apiKey);
      return ok(data);
    },

    agentcache_run_approve: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/agent/approve', 'POST', args, context.apiKey);
      return ok(data);
    },

    agentcache_run_cancel: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/agent/cancel', 'POST', args, context.apiKey);
      return ok(data);
    },

    agentcache_linguistic_scan: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/governance/linguistic/scan', 'POST', { text: args?.text }, context.apiKey);
      return ok(data);
    },

    agentcache_rosetta_decompile: async (args: any, context: ToolHandlerContext) => {
      const data = await callApi('/api/governance/linguistic/decompile', 'POST', { text: args?.text }, context.apiKey);
      return ok(data);
    },
  },
};
