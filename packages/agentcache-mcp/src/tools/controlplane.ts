/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 */

/**
 * AgentCache MCP — Control Plane tools.
 *
 * Turns the reposition into something an AGENT can use directly. Beyond caching,
 * an agent connected to AgentCache can now: see what it has saved, ask whether a
 * proposed model call is within its owner's budget/quota BEFORE spending, and
 * carry reasoning state across runs. These map 1:1 to the control-plane
 * endpoints (api/analytics/savings, api/governance/gate, api/cache/reasoning).
 */

import { ToolModule, ToolHandlerContext } from '../registry.js';

const AGENTCACHE_API_URL = process.env.AGENTCACHE_API_URL || 'https://agentcache.ai';

async function callApi(
  endpoint: string,
  method: string,
  body: any,
  apiKey: string | undefined,
  extraHeaders: Record<string, string> = {},
): Promise<any> {
  const key = apiKey || process.env.AGENTCACHE_API_KEY || process.env.API_KEY || 'ac_demo_test123';
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
      name: 'agentcache_savings',
      description:
        'Report the verified net dollars this account has saved through AgentCache over a window (default 30 days), with ROI and a breakdown by cache layer and model. Every figure is measured from real cache hits at current provider prices — never estimated. Use it to prove the value of caching to a human, or to decide whether a workload is worth continuing.',
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
  ],

  handlers: {
    agentcache_savings: async (args: any, context: ToolHandlerContext) => {
      const days = Math.min(Math.max(Number(args?.days) || 30, 1), 365);
      const data = await callApi(`/api/analytics/savings?days=${days}`, 'GET', null, context.apiKey);
      return ok({
        summary: `Net $${data.netSavedUsd} saved over ${data.windowDays}d${data.roi ? ` · ${data.roi}× ROI` : ''}`,
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
  },
};
