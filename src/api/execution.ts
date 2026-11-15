import { Hono } from 'hono';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { authenticateAdmin, authenticateApiKey } from '../middleware/auth.js';
import { executionControlService } from '../services/ExecutionControlService.js';
import { executionDriftService } from '../services/ExecutionDriftService.js';
import { executionLearningService } from '../services/ExecutionLearningService.js';
import { sharedReceiptService } from '../services/SharedReceiptService.js';
import { observabilityService } from '../services/ObservabilityService.js';
import { policyEngine } from '../services/PolicyEngine.js';
import { redactSensitiveData } from '../lib/redact-sensitive-data.js';
import { agentConnectionService } from '../services/AgentConnectionService.js';
import { getJettyStorageSummary } from '../services/JettyStorageSummaryService.js';
import { executionInvocationService } from '../services/ExecutionInvocationService.js';
import { executionDecisionAuditService } from '../services/ExecutionDecisionAuditService.js';
import { executionReviewerAuthorizationService, ReviewAssignmentConflict } from '../services/ExecutionReviewerAuthorizationService.js';
import { executionGateApprovalAuthorizationService } from '../services/ExecutionGateApprovalAuthorizationService.js';
import { evaluateExecutionInvocationReadiness } from '../services/ExecutionInvocationAuthorizationService.js';
import { executionActionBudgetService, type ExecutionBudgetScopeType } from '../services/ExecutionActionBudgetService.js';

const executionRouter = new Hono();

function requestPrincipal(c: any): string {
  const principalId = c.get?.('principalId');
  if (principalId) return principalId;
  const apiKey = c.get?.('apiKey');
  return `api-key:${createHash('sha256').update(String(apiKey || 'unknown')).digest('hex')}`;
}

function requestActorPrincipal(c: any): string {
  return c.get?.('actorPrincipalId') || requestPrincipal(c);
}

function connectionOwnerPrincipal(c: any): string {
  const principalId = c.get?.('principalId');
  const principalKind = c.get?.('principalKind');
  if ((principalKind === 'user' || principalKind === 'organization') && principalId) return principalId;
  const apiKey = c.get?.('apiKey');
  return `api-key:${createHash('sha256').update(String(apiKey || 'unknown')).digest('hex')}`;
}

async function getAccessibleRun(c: any, runId: string) {
  const run = await executionControlService.getRun(runId);
  return run?.createdBy === requestPrincipal(c) ? run : null;
}

async function getAccessibleContextPack(c: any, packId: string) {
  const pack = await executionControlService.getContextPack(packId);
  return pack?.createdBy === requestPrincipal(c) ? pack : null;
}

async function recordInvocationOutcome(c: any, run: any, input: {
  status: 'blocked' | 'error'; reason: string; connectionId?: string | null; policyDecision?: 'denied' | 'not_evaluated'; toolName?: string;
  policyEvidence?: { version?: string; ruleIds?: string[]; reasonCode?: string; score?: number };
}) {
  const gate = run.gateId ? await executionControlService.getGate(run.gateId) : null;
  const record = await executionInvocationService.record({
    executionRunId: run.id,
    contextPackVersionId: run.contextPackVersionId || null,
    runReceiptId: run.receiptId || null,
    approvalGateId: gate?.status === 'approved' ? gate.id : null,
    approvalReceiptId: gate?.status === 'approved' ? gate.receiptId || null : null,
    principalId: requestPrincipal(c),
    actorPrincipalId: requestActorPrincipal(c),
    orgId: c.get?.('orgId') || null,
    connectionId: input.connectionId || null,
    toolName: input.toolName || 'jetty.storage.summary',
    status: input.status,
    policyDecision: input.policyDecision,
    policyVersion: input.policyEvidence?.version || null,
    policyRuleIds: input.policyEvidence?.ruleIds || [],
    policyReasonCode: input.policyEvidence?.reasonCode || null,
    policyScore: input.policyEvidence?.score,
    errorCode: input.reason,
    inputSummary: { operation: 'aggregate_storage_summary' },
  });
  await executionControlService.recordToolInvocation(run.id, {
    tool: input.toolName || 'jetty.storage.summary', status: input.status, reason: input.reason,
    invocationId: record.id, connectionId: record.connectionId, recordedAt: new Date().toISOString(),
  }).catch(() => null);
  await observabilityService.track({
    type: 'POLICY',
    description: input.status === 'blocked' ? 'Jetty storage summary blocked before provider access' : 'Jetty storage summary failed before provider completion',
    sector: 'tool_execution',
    metadata: {
      action: input.toolName || 'jetty.storage.summary',
      decision: input.status === 'blocked' ? 'blocked' : 'error',
      runId: run.id,
      connectionId: record.connectionId,
      invocationId: record.id,
      reasonCode: input.policyEvidence?.reasonCode || input.reason,
    },
  }).catch(() => null);
  return record;
}

const sourceSchema = z.object({
  kind: z.string().min(1),
  uri: z.string().optional(),
  title: z.string().optional(),
  checksum: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const contextPackSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  objective: z.string().min(1),
  methodology: z.string().optional(),
  conventions: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  outputContract: z.record(z.string(), z.unknown()).optional(),
  policyProfile: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sources: z.array(sourceSchema).optional(),
  sectorHint: z.string().optional(),
  orgId: z.string().optional(),
  tierId: z.string().optional(),
  workflowTemplate: z.enum(['generic', 'policy_review', 'regulated_release', 'research_brief']).optional(),
  workflowPhases: z.array(z.string()).optional(),
  reviewerRoles: z.array(z.string()).optional(),
});

const contextPackVersionSchema = contextPackSchema.omit({ name: true, slug: true, orgId: true });

const runSchema = z.object({
  contextPackId: z.string().min(1),
  contextPackVersionId: z.string().optional(),
  inputPayload: z.record(z.string(), z.unknown()).optional(),
  outputPayload: z.record(z.string(), z.unknown()).optional(),
  trigger: z.string().optional(),
  finalAction: z.enum(['publish', 'send', 'pay', 'delete', 'external_store', 'manual']).optional(),
  requireHumanGate: z.boolean().optional(),
});

const reviewSchema = z.object({
  reviewerRole: z.string().min(1),
  verdict: z.enum(['PASS', 'REVIEW', 'BLOCK', 'INFO']),
  summary: z.string().optional(),
  findings: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const gateDecisionSchema = z.object({
  note: z.string().max(2000).optional(),
  decidedBy: z.string().max(120).optional(), // Display label supplied by the operator; credential identity is server-derived.
});

const phaseSchema = z.object({
  phase: z.string().min(1),
});

const evaluationSchema = z.object({
  mode: z.enum(['shadow']).optional(),
});

const connectionSchema = z.object({
  provider: z.string().min(2).max(64).regex(/^[a-z][a-z0-9._-]*$/),
  displayName: z.string().trim().min(1).max(120).optional(),
  scopes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  credentials: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, 'Credentials must be a non-empty object.'),
});

const jettySummaryInvocationSchema = z.object({
  tool: z.literal('jetty.storage.summary'),
  connectionId: z.string().uuid(),
  idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/).optional(),
}).strict();

function evaluateContextActionPolicy(policyProfile: Record<string, unknown> | null | undefined, action: string) {
  const profile = policyProfile || {};
  const allowedConfigured = Object.prototype.hasOwnProperty.call(profile, 'allowedActions');
  const deniedConfigured = Object.prototype.hasOwnProperty.call(profile, 'deniedActions');
  const allowedActions = profile.allowedActions;
  const deniedActions = profile.deniedActions;
  const validList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
  const evidence = { version: 'context-action-policy-v1', ruleIds: [] as string[], reasonCode: 'context_action_allowed', score: 1 };

  if ((allowedConfigured && !validList(allowedActions)) || (deniedConfigured && !validList(deniedActions))) {
    return { allowed: false, evidence: { ...evidence, ruleIds: ['context-policy-invalid-action-list'], reasonCode: 'context_policy_invalid', score: 0 } };
  }
  if (deniedConfigured && (deniedActions as string[]).some((entry) => entry === action || entry === '*')) {
    return { allowed: false, evidence: { ...evidence, ruleIds: ['context-policy-denied-action'], reasonCode: 'context_action_denied', score: 0 } };
  }
  if (allowedConfigured && !(allowedActions as string[]).some((entry) => entry === action || entry === '*')) {
    return { allowed: false, evidence: { ...evidence, ruleIds: ['context-policy-allowlist-miss'], reasonCode: 'context_action_not_allowed', score: 0 } };
  }
  evidence.ruleIds.push(allowedConfigured ? 'context-policy-allowlist-match' : 'context-policy-tool-list-authorization');
  return { allowed: true, evidence };
}

const governedToolCatalog = [
  {
    name: 'execution.list_connections',
    description: 'List owned provider connections and their scopes/status. Credential values are never returned.',
    method: 'GET',
    path: '/api/execution/connections',
    input: ['limit'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.create_connection',
    description: 'Store a user-owned provider credential encrypted at rest and record requested scopes as unverified metadata.',
    method: 'POST',
    path: '/api/execution/connections',
    input: ['provider', 'displayName', 'scopes', 'credentials'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.revoke_connection',
    description: 'Revoke an owned provider connection and clear its encrypted credential material.',
    method: 'DELETE',
    path: '/api/execution/connections/:id',
    input: ['id'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'jetty.storage.summary',
    description: 'Read an aggregate JettyThunder storage quota and file count through the owned service connection. No file names or identifiers are returned.',
    toolVersion: '1.0.0',
    inputSchemaVersion: '1.0.0',
    risk: 'low',
    effect: 'read_only',
    requiredConnection: { provider: 'jettythunder', scopes: ['storage.read', 'metadata.read'] },
    timeoutMs: 8000,
    retrySafety: 'read_only_idempotent; inspect the invocation record before retrying an incomplete call',
    approval: 'Run gate must be clear; no additional approval required for this aggregate-only read.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        tool: { type: 'string', const: 'jetty.storage.summary' },
        connectionId: { type: 'string', format: 'uuid' },
        idempotencyKey: { type: 'string', minLength: 16, maxLength: 128, pattern: '^[A-Za-z0-9._:-]+$' },
      },
      required: ['tool', 'connectionId'],
    },
    method: 'POST',
    path: '/api/execution/runs/:id/invoke',
    input: ['connectionId', 'tool: jetty.storage.summary', 'optional idempotencyKey (reuse for retries; otherwise single-shot per run/account)'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.list_context_packs',
    description: 'List context packs owned by the authenticated principal.',
    method: 'GET',
    path: '/api/execution/context-packs',
    input: ['limit'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.create_context_pack',
    description: 'Create a versioned workflow context pack owned by the authenticated principal.',
    method: 'POST',
    path: '/api/execution/context-packs',
    input: ['name', 'objective', 'tools', 'policyProfile', 'workflowPhases', 'reviewerRoles'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.get_context_pack',
    description: 'Retrieve a context pack owned by the authenticated principal.',
    method: 'GET',
    path: '/api/execution/context-packs/:id',
    input: ['id'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.create_context_pack_version',
    description: 'Add a version to an owned context pack.',
    method: 'POST',
    path: '/api/execution/context-packs/:id/versions',
    input: ['id', 'objective', 'tools', 'policyProfile', 'workflowPhases', 'reviewerRoles'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.list_runs',
    description: 'List execution runs owned by the authenticated principal.',
    method: 'GET',
    path: '/api/execution/runs',
    input: ['limit'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.start_run',
    description: 'Start a governed workflow run from a context pack. High-impact final actions can require human approval.',
    method: 'POST',
    path: '/api/execution/runs',
    input: ['contextPackId', 'contextPackVersionId', 'inputPayload', 'trigger', 'finalAction', 'requireHumanGate'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.get_run',
    description: 'Retrieve the run, gate, review, and receipt bundle for an execution.',
    method: 'GET',
    path: '/api/execution/runs/:id',
    input: ['id'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.list_invocations',
    description: 'List durable, redacted tool invocation evidence for the authenticated principal.',
    method: 'GET',
    path: '/api/execution/invocations',
    input: ['limit'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.list_run_invocations',
    description: 'List durable, redacted tool invocation evidence for an owned execution run.',
    method: 'GET',
    path: '/api/execution/runs/:id/invocations',
    input: ['id', 'limit'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.list_decision_events',
    description: 'Read durable run, review, phase, and gate history for the authenticated principal. Summaries and findings are redacted; raw workflow payloads are excluded.',
    method: 'GET',
    path: '/api/execution/decision-events',
    input: ['limit'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.get_usage',
    description: 'Read month-to-date completed, blocked, failed, and incomplete governed actions for commercial pilot measurement. Does not create a charge.',
    method: 'GET',
    path: '/api/execution/usage',
    input: [],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.evaluate_run',
    description: 'Evaluate a run for execution drift in shadow mode.',
    method: 'POST',
    path: '/api/execution/runs/:id/evaluate',
    input: ['id', 'mode'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.review_run',
    description: 'Record a review for a run owned by the authenticated principal.',
    method: 'POST',
    path: '/api/execution/runs/:id/reviews',
    input: ['id', 'reviewerRole', 'verdict', 'summary', 'findings', 'confidence'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.advance_phase',
    description: 'Advance a phase on a run owned by the authenticated principal.',
    method: 'POST',
    path: '/api/execution/runs/:id/phase',
    input: ['id', 'phase'],
    authentication: 'Bearer AgentCache API key',
  },
  {
    name: 'execution.approve_gate',
    description: 'Approve a pending gate as a different owner or administrator of the run’s organization.',
    method: 'POST',
    path: '/api/execution/gates/:id/approve',
    input: ['id', 'note', 'decidedBy'],
    authentication: 'Bearer user API key; same organization; owner/admin role; must differ from run creator',
  },
  {
    name: 'execution.reject_gate',
    description: 'Reject a pending gate as a different owner or administrator of the run’s organization.',
    method: 'POST',
    path: '/api/execution/gates/:id/reject',
    input: ['id', 'note', 'decidedBy'],
    authentication: 'Bearer user API key; same organization; owner/admin role; must differ from run creator',
  },
];

executionRouter.get('/tools', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  return c.json({ success: true, tools: governedToolCatalog });
});

function parseActionBudgetScope(scopeType: string, scopeId: string): { scopeType: ExecutionBudgetScopeType; scopeId: string } | null {
  if (scopeType === 'organization' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scopeId)) {
    return { scopeType, scopeId };
  }
  if (scopeType === 'principal' && /^(user|org|agent|api-key):[A-Za-z0-9._:-]{1,180}$/.test(scopeId)) {
    return { scopeType, scopeId };
  }
  return null;
}

executionRouter.get('/admin/action-budgets/:scopeType/:scopeId', async (c) => {
  const authError = await authenticateAdmin(c);
  if (authError) return authError;
  const scope = parseActionBudgetScope(c.req.param('scopeType'), c.req.param('scopeId'));
  if (!scope) return c.json({ error: 'Invalid action-budget scope.' }, 400);
  try {
    const budget = await executionActionBudgetService.get(scope.scopeType, scope.scopeId);
    return budget ? c.json({ success: true, budget }) : c.json({ error: 'Action budget not found.' }, 404);
  } catch {
    return c.json({ error: 'Durable action-budget storage is unavailable.' }, 503);
  }
});

executionRouter.put('/admin/action-budgets/:scopeType/:scopeId', async (c) => {
  const authError = await authenticateAdmin(c);
  if (authError) return authError;
  const scope = parseActionBudgetScope(c.req.param('scopeType'), c.req.param('scopeId'));
  if (!scope) return c.json({ error: 'Invalid action-budget scope.' }, 400);
  const body = await c.req.json().catch(() => ({}));
  const periodStart = typeof body.periodStart === 'string' ? new Date(body.periodStart) : new Date(NaN);
  const periodEnd = typeof body.periodEnd === 'string' ? new Date(body.periodEnd) : new Date(NaN);
  const actionLimit = Number(body.actionLimit);
  const durationMs = periodEnd.getTime() - periodStart.getTime();
  if (!Number.isInteger(actionLimit) || actionLimit < 1 || actionLimit > 1_000_000
    || !Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime())
    || durationMs <= 0 || durationMs > 366 * 24 * 60 * 60 * 1000) {
    return c.json({ error: 'Provide an action limit from 1 to 1,000,000 and a valid period no longer than 366 days.' }, 400);
  }
  try {
    const budget = await executionActionBudgetService.configure({
      ...scope, actionLimit, periodStart, periodEnd,
      configuredBy: (c as any).get?.('adminCredentialId') || 'admin:authenticated',
    });
    return c.json({ success: true, budget });
  } catch {
    return c.json({ error: 'Could not save the action budget.' }, 503);
  }
});

executionRouter.get('/connections', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  if ((c as any).get?.('principalKind') === 'agent') return c.json({ error: 'Provider connections require a user or organization API key.' }, 403);

  const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 100);
  const connections = await agentConnectionService.listOwned(connectionOwnerPrincipal(c), limit);
  return c.json({ success: true, connections });
});

executionRouter.post('/connections', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  if ((c as any).get?.('principalKind') === 'agent') return c.json({ error: 'Provider connections require a user or organization API key.' }, 403);

  try {
    const body = await c.req.json();
    const parsed = connectionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid connection payload.', details: parsed.error.issues }, 400);
    if (Buffer.byteLength(JSON.stringify(parsed.data.credentials), 'utf8') > 32_768) {
      return c.json({ error: 'Credential payload exceeds the 32 KB limit.' }, 413);
    }

    const safeMetadata = redactSensitiveData({
      provider: parsed.data.provider,
      displayName: parsed.data.displayName,
      scopes: parsed.data.scopes,
    });
    const connection = await agentConnectionService.create({
      ...safeMetadata,
      credentials: parsed.data.credentials,
      ownerPrincipalId: connectionOwnerPrincipal(c),
      orgId: (c as any).get?.('orgId') || null,
    });
    await observabilityService.track({
      type: 'POLICY',
      description: `Provider connection ${connection.id} saved in unverified state`,
      sector: 'tool_execution',
      metadata: {
        action: 'execution.connection.create',
        connectionId: connection.id,
        provider: connection.provider,
        principalId: connectionOwnerPrincipal(c),
        verificationStatus: connection.verificationStatus,
      },
    }).catch(() => null);
    return c.json({ success: true, connection }, 201);
  } catch (error: any) {
    if (error?.message === 'connection_encryption_unavailable') {
      return c.json({ error: 'Connection storage is not configured on this deployment.' }, 503);
    }
    return c.json({ error: 'Could not save provider connection.' }, 500);
  }
});

executionRouter.delete('/connections/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  if ((c as any).get?.('principalKind') === 'agent') return c.json({ error: 'Provider connections require a user or organization API key.' }, 403);

  try {
    const connection = await agentConnectionService.revokeOwned(c.req.param('id'), connectionOwnerPrincipal(c));
    if (!connection) return c.json({ error: 'Provider connection not found.' }, 404);
    await observabilityService.track({
      type: 'POLICY',
      description: `Provider connection ${connection.id} revoked`,
      sector: 'tool_execution',
      metadata: {
        action: 'execution.connection.revoke',
        connectionId: connection.id,
        provider: connection.provider,
        principalId: connectionOwnerPrincipal(c),
        status: connection.status,
      },
    }).catch(() => null);
    return c.json({ success: true, connection });
  } catch {
    return c.json({ error: 'Could not revoke provider connection.' }, 500);
  }
});

executionRouter.post('/runs/:id/invoke', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  const run = await getAccessibleRun(c, c.req.param('id'));
  if (!run) return c.json({ error: 'Execution run not found.' }, 404);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid invocation payload.' }, 400); }
  if (body?.tool !== 'jetty.storage.summary' || typeof body?.connectionId !== 'string') {
    await recordInvocationOutcome(c, run, { status: 'blocked', reason: 'tool_not_allowlisted', toolName: 'unregistered_tool' });
    return c.json({ error: 'Tool is not available for this pilot.' }, 403);
  }
  const parsedInvocation = jettySummaryInvocationSchema.safeParse(body);
  if (!parsedInvocation.success) return c.json({ error: 'Invalid Jetty summary input. Supply only a valid connectionId and optional idempotencyKey.' }, 400);
  body = parsedInvocation.data;
  // Preserve compatibility for existing callers while making their retries safe:
  // without an explicit key, this read-only action is single-shot per run/account.
  const idempotencyKey = body.idempotencyKey || `auto:${run.id}:${body.connectionId}:${body.tool}`;
  const idempotencyKeyHash = createHash('sha256').update(idempotencyKey).digest('hex');
  const requestHash = createHash('sha256').update(JSON.stringify({
    executionRunId: run.id,
    connectionId: body.connectionId,
    tool: body.tool,
  })).digest('hex');
  const respondWithPriorInvocation = (invocation: any) => {
    if (invocation.requestHash !== requestHash) return c.json({ error: 'Idempotency key was already used for a different action.' }, 409);
    if (invocation.status === 'completed') {
      return c.json({ success: true, invocation: {
        tool: invocation.toolName,
        status: invocation.status,
        invocationId: invocation.id,
        connectionId: invocation.connectionId,
        result: invocation.resultSummary,
        recordedAt: new Date(invocation.completedAt || invocation.startedAt).toISOString(),
        replayed: true,
      } });
    }
    return c.json({
      error: 'This action already has an execution record. Inspect its history before starting a new action.',
      code: 'execution_invocation_already_exists',
      status: invocation.status,
      invocationId: invocation.id,
      retryWithNewKey: invocation.status === 'error' || invocation.status === 'blocked',
    }, 409);
  };
  const bundle = await executionControlService.getRunBundle(run.id);
  if (!bundle || !bundle.contextPackVersion.tools.includes('jetty.storage.summary')) {
    await recordInvocationOutcome(c, run, { status: 'blocked', reason: 'tool_not_in_context_pack' });
    return c.json({ error: 'This tool is not enabled in the execution context pack.' }, 403);
  }
  const contextActionPolicy = evaluateContextActionPolicy(bundle.contextPackVersion.policyProfile, 'jetty.storage.summary');
  if (!contextActionPolicy.allowed) {
    await recordInvocationOutcome(c, run, {
      status: 'blocked', reason: contextActionPolicy.evidence.reasonCode, connectionId: body.connectionId,
      policyDecision: 'denied', policyEvidence: contextActionPolicy.evidence,
    });
    return c.json({ error: 'Tool call blocked by the workflow action policy.', code: contextActionPolicy.evidence.reasonCode }, 403);
  }
  const readiness = evaluateExecutionInvocationReadiness(run);
  if ('reason' in readiness && readiness.reason === 'required_review_incomplete') {
    await recordInvocationOutcome(c, run, { status: 'blocked', reason: readiness.reason });
    return c.json({
      error: 'Required workflow reviews must pass before provider access.',
      code: readiness.reason,
      pendingReviewerRoles: readiness.pendingReviewerRoles,
    }, 403);
  }
  if ('reason' in readiness) {
    await recordInvocationOutcome(c, run, { status: 'blocked', reason: readiness.reason });
    return c.json({ error: 'Execution run is blocked or awaiting approval.' }, 403);
  }

  const connection = await agentConnectionService.getOwned(body.connectionId, connectionOwnerPrincipal(c));
  if (!connection || connection.status !== 'active' || connection.provider !== 'jettythunder') {
    await recordInvocationOutcome(c, run, { status: 'blocked', reason: 'connection_unavailable' });
    return c.json({ error: 'Active JettyThunder connection not found.' }, 404);
  }
  if (connection.verificationStatus === 'expired') {
    await recordInvocationOutcome(c, run, { status: 'blocked', reason: 'connection_expired', connectionId: connection.id });
    return c.json({ error: 'JettyThunder connection credentials expired. Disconnect and add a current service key.' }, 409);
  }
  if (!connection.scopes.some((scope) => scope === 'storage.read' || scope === 'metadata.read')) {
    await recordInvocationOutcome(c, run, { status: 'blocked', reason: 'read_scope_required', connectionId: connection.id });
    return c.json({ error: 'Connection must declare storage.read or metadata.read.' }, 403);
  }

  const policy = await policyEngine.evaluate({
    content: 'Read aggregate storage quota and file count from the connected JettyThunder account.',
    sector: 'tool_execution',
    origin: 'agentcache.execution.invoke',
    originAgent: (c as any).get?.('principalId') || undefined,
    payload: { action: 'jetty.storage.summary', connectionId: connection.id, runId: run.id },
  });
  if (!policy.allowed) {
    await recordInvocationOutcome(c, run, {
      status: 'blocked', reason: 'policy_denied', connectionId: connection.id, policyDecision: 'denied',
      policyEvidence: {
        version: policy.policyVersion,
        ruleIds: policy.evaluatedPolicyIds,
        reasonCode: policy.reasonCode || 'policy_denied',
        score: policy.score,
      },
    });
    return c.json({ error: 'Tool call blocked by policy.' }, 403);
  }

  let durableInvocationId: string | null = null;
  let providerResponseReceived = false;
  try {
    const credentials = await agentConnectionService.getCredentialsForInvocation(connection.id, connectionOwnerPrincipal(c));
    const serviceKey = credentials?.serviceKey;
    if (typeof serviceKey !== 'string') {
      await recordInvocationOutcome(c, run, { status: 'error', reason: 'stored_connection_unavailable', connectionId: connection.id });
      return c.json({ error: 'Stored provider connection is unavailable.' }, 409);
    }
    const claimedInvocation = await executionInvocationService.startIdempotent({
      executionRunId: run.id,
      contextPackVersionId: run.contextPackVersionId || null,
      runReceiptId: run.receiptId || null,
      approvalGateId: bundle.gate?.status === 'approved' ? bundle.gate.id : null,
      approvalReceiptId: bundle.gate?.status === 'approved' ? bundle.gate.receiptId || null : null,
      principalId: requestPrincipal(c),
      actorPrincipalId: requestActorPrincipal(c),
      orgId: (c as any).get?.('orgId') || null,
      connectionId: connection.id,
      toolName: 'jetty.storage.summary',
      policyVersion: policy.policyVersion,
      policyRuleIds: policy.evaluatedPolicyIds,
      policyScore: policy.score,
      idempotencyKeyHash,
      requestHash,
      inputSummary: { operation: 'aggregate_storage_summary' },
    });
    if (claimedInvocation.duplicate) return respondWithPriorInvocation(claimedInvocation.invocation);
    const invocation = claimedInvocation.invocation;
    durableInvocationId = invocation.id;
    const orgId = (c as any).get?.('orgId') || null;
    let budget;
    try {
      budget = await executionActionBudgetService.reserve({
        scopeType: orgId ? 'organization' : 'principal',
        scopeId: orgId || requestPrincipal(c),
        invocationId: invocation.id,
        executionRunId: run.id,
      });
    } catch {
      await executionInvocationService.finish(invocation.id, { status: 'error', errorCode: 'execution_action_budget_unavailable' }).catch(() => null);
      return c.json({ error: 'Action budget could not be verified; provider call was not sent.', code: 'execution_action_budget_unavailable' }, 503);
    }
    if (!budget.allowed) {
      await executionInvocationService.finish(invocation.id, {
        status: 'blocked', policyDecision: 'denied', errorCode: budget.reasonCode,
      }).catch(() => null);
      await executionControlService.recordToolInvocation(run.id, {
        tool: 'jetty.storage.summary', status: 'blocked', reason: budget.reasonCode,
        invocationId: invocation.id, connectionId: connection.id, recordedAt: new Date().toISOString(),
      }).catch(() => null);
      await observabilityService.track({
        type: 'POLICY', description: 'Jetty storage summary blocked by action budget', sector: 'tool_execution',
        metadata: { action: 'jetty.storage.summary', decision: 'blocked', reasonCode: budget.reasonCode, runId: run.id, invocationId: invocation.id },
      }).catch(() => null);
      const status = budget.reasonCode === 'execution_action_cap_reached' ? 429
        : budget.reasonCode === 'execution_action_budget_not_configured' ? 503 : 409;
      return c.json({ error: 'Action budget blocked this provider call.', code: budget.reasonCode,
        ...(budget.reasonCode === 'execution_action_cap_reached' ? { budget: { reservedCount: budget.reservedCount, actionLimit: budget.actionLimit, periodEnd: budget.periodEnd } } : {}),
      }, status);
    }
    await executionControlService.recordToolInvocation(run.id, {
      tool: 'jetty.storage.summary', status: 'started', invocationId: invocation.id,
      connectionId: connection.id, recordedAt: invocation.startedAt.toISOString(),
    }).catch(() => null);
    const summary = await getJettyStorageSummary(serviceKey);
    providerResponseReceived = true;
    await agentConnectionService.markVerified(connection.id, connectionOwnerPrincipal(c));
    const terminalRecord = await executionInvocationService.finish(invocation.id, { status: 'completed', resultSummary: summary });
    if (!terminalRecord) throw new Error('execution_evidence_incomplete');
    const invocationEvent = { tool: 'jetty.storage.summary', status: 'completed', invocationId: invocation.id, connectionId: connection.id, result: summary, recordedAt: new Date().toISOString() };
    await executionControlService.recordToolInvocation(run.id, invocationEvent).catch(() => null);
    await observabilityService.track({ type: 'POLICY', description: 'Jetty storage summary completed', sector: 'tool_execution', metadata: { action: 'jetty.storage.summary', decision: 'allowed', runId: run.id, connectionId: connection.id, invocationId: invocation.id } }).catch(() => null);
    return c.json({ success: true, invocation: invocationEvent });
  } catch (error: any) {
    if (error?.message === 'execution_idempotency_conflict') {
      return c.json({ error: 'Idempotency key was already used for a different action.' }, 409);
    }
    const code = ['provider_credentials_expired', 'provider_permission_denied', 'provider_request_failed', 'provider_response_invalid', 'provider_timeout', 'provider_credentials_invalid', 'execution_evidence_incomplete'].includes(error?.message) ? error.message : 'provider_request_failed';
    if (error?.message === 'provider_credentials_expired') {
      await agentConnectionService.markExpired(connection.id, connectionOwnerPrincipal(c)).catch(() => null);
    }
    if (durableInvocationId) {
      if (!providerResponseReceived) {
        await executionInvocationService.finish(durableInvocationId, { status: 'error', errorCode: code }).catch(() => null);
        await executionControlService.recordToolInvocation(run.id, { tool: 'jetty.storage.summary', status: 'error', error: code, invocationId: durableInvocationId, connectionId: connection.id, recordedAt: new Date().toISOString() }).catch(() => null);
      }
    } else {
      const failedInvocation = await recordInvocationOutcome(c, run, { status: 'error', reason: code, connectionId: connection.id });
      durableInvocationId = failedInvocation.id;
    }
    await observabilityService.track({ type: 'POLICY', description: 'Jetty storage summary failed', sector: 'tool_execution', metadata: { action: 'jetty.storage.summary', decision: 'error', runId: run.id, connectionId: connection.id, invocationId: durableInvocationId, error: code } }).catch(() => null);
    if (providerResponseReceived) return c.json({ error: 'Provider replied, but AgentCache could not complete the durable evidence record. Treat this run as incomplete.', code: 'execution_evidence_incomplete', invocationId: durableInvocationId }, 503);
    return c.json({ error: 'Provider request failed.', code }, 502);
  }
});

executionRouter.get('/context-packs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const limit = Math.min(Math.max(Number(c.req.query('limit') || 25), 1), 100);
  const packs = (await executionControlService.listContextPacks(limit, requestPrincipal(c)))
    .filter((pack) => pack.createdBy === requestPrincipal(c));
  return c.json({ success: true, packs });
});

executionRouter.get('/runs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const limit = Math.min(Math.max(Number(c.req.query('limit') || 25), 1), 100);
  const runs = (await executionControlService.listRuns(limit, requestPrincipal(c)))
    .filter((run) => run.createdBy === requestPrincipal(c));
  return c.json({ success: true, runs });
});

executionRouter.get('/invocations', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  try {
    const invocations = await executionInvocationService.listPrincipal(
      requestPrincipal(c), Number(c.req.query('limit') || 50),
    );
    return c.json({ success: true, invocations });
  } catch {
    return c.json({ error: 'Durable invocation history is unavailable.' }, 503);
  }
});

executionRouter.get('/decision-events', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  try {
    const decisionEvents = await executionDecisionAuditService.listForOwner(
      requestPrincipal(c), Number(c.req.query('limit') || 50),
    );
    return c.json({ success: true, decisionEvents });
  } catch {
    return c.json({ error: 'Durable decision history is unavailable.' }, 503);
  }
});

executionRouter.get('/usage', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  try {
    const usage = await executionInvocationService.getMonthlyUsage(
      requestPrincipal(c), (c as any).get?.('orgId') || null,
    );
    const orgId = (c as any).get?.('orgId') || null;
    const budget = await executionActionBudgetService.get(orgId ? 'organization' : 'principal', orgId || requestPrincipal(c));
    const now = Date.now();
    const actionBudget = budget ? {
      configured: true,
      active: new Date(budget.periodStart).getTime() <= now && new Date(budget.periodEnd).getTime() > now,
      actionLimit: Number(budget.actionLimit),
      reservedCount: Number(budget.reservedCount),
      remaining: Math.max(0, Number(budget.actionLimit) - Number(budget.reservedCount)),
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
      counts: 'provider_attempts_including_errors',
    } : { configured: false, active: false, actionLimit: null, reservedCount: 0, remaining: null };
    return c.json({ success: true, usage: { ...usage, actionBudget } });
  } catch {
    return c.json({ error: 'Governed-action usage is unavailable.' }, 503);
  }
});

executionRouter.post('/context-packs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = contextPackSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const safeData = redactSensitiveData(parsed.data);
    const result = await executionControlService.createContextPack({
      ...safeData,
      orgId: (c as any).get?.('orgId') || undefined,
    }, {
      principalId: requestPrincipal(c),
    });

    await sharedReceiptService.ingest(result.receipt, {
      apiKey: (c as any).get?.('apiKey') || undefined,
      principalId: (c as any).get?.('principalId') || undefined,
    }).catch(() => null);

    return c.json({ success: true, pack: result.pack, version: result.version, receipt: result.receipt }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to create context pack.' }, 500);
  }
});

executionRouter.get('/context-packs/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const pack = await getAccessibleContextPack(c, c.req.param('id'));
  if (!pack) {
    return c.json({ error: 'Context pack not found.' }, 404);
  }

  const version = await executionControlService.getContextPackVersion(pack.latestVersionId);
  return c.json({ success: true, pack, latestVersion: version });
});

executionRouter.post('/context-packs/:id/versions', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const pack = await getAccessibleContextPack(c, c.req.param('id'));
    if (!pack) return c.json({ error: 'Context pack not found.' }, 404);
    const body = await c.req.json();
    const parsed = contextPackVersionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await executionControlService.addContextPackVersion(c.req.param('id'), redactSensitiveData(parsed.data), {
      principalId: (c as any).get?.('principalId') || undefined,
    });

    await sharedReceiptService.ingest(result.receipt, {
      apiKey: (c as any).get?.('apiKey') || undefined,
      principalId: (c as any).get?.('principalId') || undefined,
    }).catch(() => null);

    return c.json({ success: true, pack: result.pack, version: result.version, receipt: result.receipt }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to create context pack version.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

executionRouter.post('/runs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }
    if (!(await getAccessibleContextPack(c, parsed.data.contextPackId))) {
      return c.json({ error: 'Context pack not found.' }, 404);
    }

    const safeData = redactSensitiveData(parsed.data);
    const policy = await policyEngine.evaluate({
      content: `Start governed execution for context pack ${parsed.data.contextPackId}`,
      sector: 'tool_execution',
      origin: 'agentcache.execution.start_run',
      originAgent: (c as any).get?.('principalId') || undefined,
      payload: { action: 'start_run', ...safeData },
    });
    if (!policy.allowed) {
      await observabilityService.track({
        type: 'POLICY',
        description: 'Governed tool call blocked by policy',
        sector: 'tool_execution',
        metadata: { action: 'execution.start_run', contextPackId: parsed.data.contextPackId, decision: 'blocked', reason: policy.reason },
      }).catch(() => null);
      return c.json({ error: 'Tool call blocked by policy.', reason: policy.reason }, 403);
    }

    const result = await executionControlService.startRun(safeData, {
      principalId: requestPrincipal(c),
      actorPrincipalId: requestActorPrincipal(c),
      orgId: (c as any).get?.('orgId') || undefined,
    });

    await observabilityService.track({
      type: 'POLICY',
      description: `Governed execution run ${result.run.id} started`,
      sector: 'tool_execution',
      metadata: {
        action: 'execution.start_run',
        runId: result.run.id,
        contextPackId: result.pack.id,
        finalAction: parsed.data.finalAction || 'manual',
        decision: result.gate ? 'approval_required' : 'allowed',
        principalId: (c as any).get?.('principalId') || null,
      },
    }).catch(() => null);

    await sharedReceiptService.ingest(result.receipt, {
      apiKey: (c as any).get?.('apiKey') || undefined,
      principalId: (c as any).get?.('principalId') || undefined,
    }).catch(() => null);

    return c.json({
      success: true,
      run: result.run,
      gate: result.gate,
      contextPack: result.pack,
      contextPackVersion: result.version,
      receipt: result.receipt,
    }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to start execution run.';
    await observabilityService.track({
      type: 'POLICY',
      description: 'Governed execution run failed before completion',
      sector: 'tool_execution',
      metadata: { action: 'execution.start_run', decision: 'error', errorType: message.toLowerCase().includes('not found') ? 'resource_not_found' : 'execution_error' },
    }).catch(() => null);
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

executionRouter.get('/runs/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const run = await getAccessibleRun(c, c.req.param('id'));
  if (!run) return c.json({ error: 'Execution run not found.' }, 404);
  const bundle = await executionControlService.getRunBundle(c.req.param('id'));
  if (!bundle) {
    return c.json({ error: 'Execution run not found.' }, 404);
  }
  try {
    const decisionEvents = await executionDecisionAuditService.listForRun(bundle.run.id, requestPrincipal(c));
    return c.json({ success: true, ...bundle, decisionEvents });
  } catch {
    return c.json({ error: 'Durable decision history is unavailable.' }, 503);
  }
});

executionRouter.get('/runs/:id/invocations', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  const run = await getAccessibleRun(c, c.req.param('id'));
  if (!run) return c.json({ error: 'Execution run not found.' }, 404);
  try {
    const invocations = await executionInvocationService.listOwned(
      run.id, requestPrincipal(c), Number(c.req.query('limit') || 50),
    );
    return c.json({ success: true, invocations });
  } catch {
    return c.json({ error: 'Durable invocation history is unavailable.' }, 503);
  }
});

executionRouter.get('/runs/:id/evaluations', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const run = await getAccessibleRun(c, c.req.param('id'));
  if (!run) {
    return c.json({ error: 'Execution run not found.' }, 404);
  }

  const evaluations = await executionDriftService.listRunEvaluations(run.id, Number(c.req.query('limit') || 25));
  return c.json({ success: true, evaluations });
});

executionRouter.get('/runs/:id/recommendations', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    if (!(await getAccessibleRun(c, c.req.param('id')))) return c.json({ error: 'Execution run not found.' }, 404);
    const report = await executionLearningService.recommendForRun(c.req.param('id'));
    return c.json({ success: true, report });
  } catch (error: any) {
    const message = error?.message || 'Failed to derive execution recommendations.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

executionRouter.post('/runs/:id/evaluate', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    if (!(await getAccessibleRun(c, c.req.param('id')))) return c.json({ error: 'Execution run not found.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const parsed = evaluationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const policy = await policyEngine.evaluate({
      content: `Evaluate execution run ${c.req.param('id')}`,
      sector: 'tool_execution',
      origin: 'agentcache.execution.evaluate_run',
      originAgent: (c as any).get?.('principalId') || undefined,
      payload: { action: 'evaluate_run', runId: c.req.param('id'), mode: parsed.data.mode || 'shadow' },
    });
    if (!policy.allowed) {
      await observabilityService.track({
        type: 'POLICY',
        description: 'Governed tool call blocked by policy',
        sector: 'tool_execution',
        metadata: { action: 'execution.evaluate_run', runId: c.req.param('id'), decision: 'blocked', reason: policy.reason },
      }).catch(() => null);
      return c.json({ error: 'Tool call blocked by policy.', reason: policy.reason }, 403);
    }

    const evaluation = await executionDriftService.evaluateRun(c.req.param('id'), parsed.data.mode || 'shadow');
    await observabilityService.track({
      type: 'POLICY',
      description: `Governed run ${c.req.param('id')} evaluated`,
      sector: 'tool_execution',
      metadata: { action: 'execution.evaluate_run', runId: c.req.param('id'), decision: 'allowed' },
    }).catch(() => null);
    return c.json({ success: true, evaluation }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to evaluate execution drift.';
    await observabilityService.track({
      type: 'POLICY',
      description: 'Governed run evaluation failed before completion',
      sector: 'tool_execution',
      metadata: { action: 'execution.evaluate_run', runId: c.req.param('id'), decision: 'error', errorType: message.toLowerCase().includes('not found') ? 'resource_not_found' : 'evaluation_error' },
    }).catch(() => null);
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

executionRouter.post('/runs/:id/reviews', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const run = await executionControlService.getRun(c.req.param('id'));
    if (!run) return c.json({ error: 'Execution run not found.' }, 404);
    const body = await c.req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }
    if (!run.requiredReviewerRoles.includes(parsed.data.reviewerRole)) {
      return c.json({ error: 'Reviewer role is not required for this execution run.' }, 400);
    }

    // Demo credentials exist only in the mock/test auth mode. Give each synthetic
    // role a separate principal so contract tests can exercise workflow transitions;
    // production credentials always pass the organization-membership authorization below.
    const apiKey = (c as any).get?.('apiKey');
    const isDemoHarness = (process.env.VITEST || process.env.NODE_ENV === 'test') && String(apiKey || '').startsWith('ac_demo_');
    const reviewerPrincipalId = isDemoHarness
      ? `test-reviewer:${c.req.param('id')}:${parsed.data.reviewerRole}`
      : requestActorPrincipal(c);
    if (!isDemoHarness) {
      const authorization = await executionReviewerAuthorizationService.authorize({
        run,
        reviewerPrincipalId,
        reviewerUserId: (c as any).get?.('actorUserId') || null,
        organizationId: (c as any).get?.('orgId') || null,
      });
      if ('reason' in authorization) {
        return c.json({ error: 'A review must come from a different authenticated member of the same organization.', reason: authorization.reason }, 403);
      }
    }
    let assignment: { claimed: boolean; existing?: boolean };
    try {
      assignment = await executionReviewerAuthorizationService.claimRole({
        executionRunId: run.id,
        reviewerPrincipalId,
        reviewerRole: parsed.data.reviewerRole,
      });
      if (!assignment.claimed) {
        const existingReview = (await executionControlService.listReviews(run.id))
          .find((review) => review.reviewerPrincipalId === reviewerPrincipalId);
        if (!existingReview) {
          return c.json({
            error: 'A review submission from this identity is still being recorded. Retry the same request shortly.',
            code: 'review_submission_in_progress',
          }, 409);
        }
        const normalizedReview = redactSensitiveData(parsed.data) as any;
        const matchesExisting = existingReview.reviewerRole === parsed.data.reviewerRole
          && existingReview.verdict === parsed.data.verdict
          && (existingReview.summary || null) === (normalizedReview.summary || null)
          && JSON.stringify(existingReview.findings || []) === JSON.stringify(normalizedReview.findings || [])
          && (existingReview.confidence ?? null) === (parsed.data.confidence ?? null);
        if (!matchesExisting) {
          return c.json({
            error: 'This reviewer role already has a different recorded decision.',
            code: 'review_already_recorded',
          }, 409);
        }
        const currentRun = await executionControlService.getRun(run.id);
        return c.json({ success: true, duplicate: true, review: existingReview, run: currentRun }, 200);
      }
    } catch (error: any) {
      if (error instanceof ReviewAssignmentConflict) {
        return c.json({ error: 'A reviewer may fill only one required role on a run.', reason: error.reason }, 409);
      }
      throw error;
    }

    let result;
    try {
      result = await executionControlService.recordReview({
        runId: c.req.param('id'),
        reviewerPrincipalId,
        ...redactSensitiveData(parsed.data),
      });
    } catch (error) {
      if (assignment.claimed) {
        try {
          const persistedReview = (await executionControlService.listReviews(run.id))
            .some((review) => review.reviewerPrincipalId === reviewerPrincipalId);
          if (!persistedReview) {
            await executionReviewerAuthorizationService.releaseRoleClaim({
              executionRunId: run.id, reviewerPrincipalId, reviewerRole: parsed.data.reviewerRole,
            });
          }
        } catch {
          // Keep the claim when persistence state is uncertain; a later retry can resolve it safely.
        }
      }
      throw error;
    }

    await sharedReceiptService.ingest(result.receipt, {
      apiKey: (c as any).get?.('apiKey') || undefined,
      principalId: (c as any).get?.('principalId') || undefined,
    }).catch(() => null);

    return c.json({ success: true, review: result.review, run: result.run, receipt: result.receipt }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to record review.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

executionRouter.post('/runs/:id/phase', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    if (!(await getAccessibleRun(c, c.req.param('id')))) return c.json({ error: 'Execution run not found.' }, 404);
    const body = await c.req.json();
    const parsed = phaseSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const run = await executionControlService.advancePhase({
      runId: c.req.param('id'),
      phase: parsed.data.phase,
      actorPrincipalId: requestActorPrincipal(c),
    });

    return c.json({ success: true, run });
  } catch (error: any) {
    const message = error?.message || 'Failed to advance workflow phase.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 400);
  }
});

async function decideExecutionGate(c: any, decision: 'approved' | 'rejected', platformAdmin = false) {
  const authError = platformAdmin ? await authenticateAdmin(c) : await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const gateId = c.req.param('id');
    const gate = await executionControlService.getGate(gateId);
    if (!gate) return c.json({ error: 'Execution gate not found.' }, 404);
    const run = await executionControlService.getRun(gate.executionRunId);
    if (!run) return c.json({ error: 'Execution run not found.' }, 404);

    let actorRole = platformAdmin ? 'platform_admin' : 'unspecified';
    if (!platformAdmin) {
      const authorization = await executionGateApprovalAuthorizationService.authorize({
        run,
        approverPrincipalId: requestActorPrincipal(c),
        approverUserId: c.get?.('actorUserId') || null,
        organizationId: c.get?.('orgId') || null,
      });
      if ('reason' in authorization) {
        return c.json({
          error: 'Gate decisions require a different owner or administrator in the run’s organization.',
          reason: authorization.reason,
        }, 403);
      }
      actorRole = authorization.actorRole;
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = gateDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const decidedByPrincipalId = platformAdmin
      ? c.get?.('adminCredentialId') || 'admin:authenticated'
      : requestActorPrincipal(c);
    const defaultDecidedBy = platformAdmin ? 'platform-operator'
      : actorRole === 'owner' ? 'organization-owner' : 'organization-admin';
    const result = await executionControlService.decideGate({
      gateId,
      decision,
      actorRole,
      decidedBy: redactSensitiveData(parsed.data.decidedBy || defaultDecidedBy),
      decidedByPrincipalId,
      note: redactSensitiveData(parsed.data.note),
    });

    await sharedReceiptService.ingest(result.receipt, {
      principalId: platformAdmin ? decidedByPrincipalId : requestPrincipal(c),
    }).catch(() => null);

    return c.json({ success: true, gate: result.gate, run: result.run, receipt: result.receipt });
  } catch (error: any) {
    const message = error?.message || `Failed to ${decision === 'approved' ? 'approve' : 'reject'} gate.`;
    if (message.includes('already been decided')) return c.json({ error: message, code: 'gate_already_decided' }, 409);
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
}

executionRouter.post('/gates/:id/approve', (c) => decideExecutionGate(c, 'approved'));
executionRouter.post('/gates/:id/reject', (c) => decideExecutionGate(c, 'rejected'));

// Platform-level break-glass route. It is deliberately separate from the
// customer-facing organization-admin approval path and omitted from MCP discovery.
executionRouter.post('/admin/gates/:id/approve', (c) => decideExecutionGate(c, 'approved', true));
executionRouter.post('/admin/gates/:id/reject', (c) => decideExecutionGate(c, 'rejected', true));

export default executionRouter;
