/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

import { Hono } from 'hono';
import { inngest } from '../inngest/client.js';
import { validateApiKey } from '../../lib/api-key-middleware.js';
import { initRun } from '../../lib/agent-runtime.js';
import { assertRunOwnership, verifyApprovalToken, isValidRunId } from '../../lib/run-authz.js';
import { persistRun, ensureAgentRunSchema } from '../../lib/run-store.js';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

const app = new Hono();
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

// Auth helper for Agent API endpoints
async function getAuthContext(c: any) {
  const authHeader = c.req.header('Authorization') || c.req.header('X-API-Key');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return { error: 'Valid AgentCache API key (ac_...) required', status: 401 };
  }
  try {
    const keyContext = await validateApiKey(apiKey);
    return { keyContext, status: 200 };
  } catch (err: any) {
    return { error: err.message || 'Unauthorized', status: 401 };
  }
}

/**
 * POST /api/agent/dispatch or /api/agent/run
 * Dispatches a durable, governed background agent run via Inngest.
 */
async function handleDispatch(c: any) {
  const auth = await getAuthContext(c);
  if (auth.error) return c.json({ error: 'Unauthorized', message: auth.error }, auth.status as any);

  try {
    const body = (await c.req.json().catch(() => ({}))) || {};
    // runId is interpolated into Inngest CEL match expressions downstream and is
    // the key authorization is checked against. A caller-supplied id is accepted
    // only if it survives the strict charset; otherwise we mint our own.
    const requested = body.runId ? String(body.runId) : '';
    const runId = isValidRunId(requested)
      ? requested
      : `run_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const agentId = body.agentId || 'background_agent';
    const namespace = body.namespace || auth.keyContext?.allowedNamespaces?.[0] || 'default';
    const organizationId = auth.keyContext?.organizationId || 'default_org';
    const goal = body.goal || '';
    const steps = Array.isArray(body.steps) ? body.steps : [];
    const approvalThresholdUsd = typeof body.approvalThresholdUsd === 'number' ? body.approvalThresholdUsd : 0;
    const webhookUrl = body.webhookUrl || null;

    // Send event to durable Inngest queue
    await inngest.send({
      name: 'agent/run.start',
      data: {
        runId,
        agentId,
        namespace,
        organizationId,
        goal,
        steps,
        approvalThresholdUsd,
        webhookUrl,
      },
    });

    // Record ownership BEFORE the run can be acted on. This row is what
    // assertRunOwnership() checks, so it must exist before any approve/cancel
    // can arrive — awaited, not fire-and-forget.
    if (sql) {
      await ensureAgentRunSchema(sql);
      await persistRun({ sql }, initRun({ runId, agentId, namespace, goal }), { organizationId });
    }

    return c.json({
      ok: true,
      runId,
      agentId,
      status: 'dispatched',
      stepsCount: steps.length,
      approvalThresholdUsd,
      message: 'Background agent run dispatched to durable execution harness.',
    }, 202);
  } catch (err: any) {
    return c.json({ error: 'Dispatch Failed', message: err.message }, 500);
  }
}

app.post('/dispatch', handleDispatch);
app.post('/run', handleDispatch);

/**
 * GET /api/agent/run/:runId or /api/agent/status/:runId
 * Retrieves live run status, spend, savings, and checkpoint state.
 */
app.get('/run/:runId', async (c) => {
  const auth = await getAuthContext(c);
  if (auth.error) return c.json({ error: 'Unauthorized', message: auth.error }, auth.status as any);

  const runId = c.req.param('runId');
  if (!runId) return c.json({ error: 'runId required' }, 400);

  try {
    let runRecord = null;
    if (sql) {
      const rows = await sql`
        SELECT * FROM background_agent_runs
        WHERE run_id = ${runId} AND organization_id = ${auth.keyContext?.organizationId}
        LIMIT 1
      `.catch(() => []);
      if (rows && rows.length > 0) runRecord = rows[0];
    }

    if (runRecord) {
      return c.json({
        runId: runRecord.run_id,
        agentId: runRecord.agent_id,
        namespace: runRecord.namespace,
        goal: runRecord.goal,
        status: runRecord.status,
        spentUsd: parseFloat(runRecord.spent_usd) || 0,
        savedUsd: parseFloat(runRecord.saved_usd) || 0,
        stepsExecuted: runRecord.steps_executed,
        checkpoint: runRecord.checkpoint_state || {},
        reasons: runRecord.reasons || [],
        createdAt: runRecord.created_at,
        updatedAt: runRecord.updated_at,
      });
    }

    // No row for this org: either the run does not exist or it is not theirs.
    // Do NOT invent a status — reporting 'running' for a finished or foreign run
    // is how a dashboard lies about money.
    return c.json({ error: 'Not Found', message: 'No such run for this organization' }, 404);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/status/:runId', async (c) => {
  return c.redirect(`/api/agent/run/${c.req.param('runId')}`);
});

/**
 * POST /api/agent/approve
 * Resumes or terminates a paused background agent.
 */
app.post('/approve', async (c) => {
  const auth = await getAuthContext(c);
  if (auth.error) return c.json({ error: 'Unauthorized', message: auth.error }, auth.status as any);

  try {
    const body = (await c.req.json().catch(() => ({}))) || {};
    if (!body.runId) return c.json({ error: 'runId required' }, 400);
    if (!isValidRunId(String(body.runId))) return c.json({ error: 'Bad Request', message: 'invalid runId' }, 400);

    // AUTHORIZE THE OBJECT, not just the caller. A valid API key proves who is
    // asking; it does not prove the run is theirs. Without this check any
    // customer could approve or kill any other customer's paused agent.
    const own = await assertRunOwnership({ sql }, String(body.runId), auth.keyContext?.organizationId);
    if (!own.ok) return c.json({ error: 'Forbidden', message: own.reason }, own.status as any);

    const decision = body.decision === 'approve' ? 'approve' : 'reject';
    return emitDecision(c, String(body.runId), decision, own.organizationId);
  } catch (err: any) {
    return c.json({ error: err.message }, err.status || 500);
  }
});

/**
 * GET /api/agent/approve?token=...
 * The Slack/email button path. The signed token IS the authorization: it names
 * the run, the org, the step and the single decision it permits, and it expires.
 * No API key — and no ability to touch any other run.
 */
app.get('/approve', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.json({ error: 'Bad Request', message: 'token required' }, 400);

  const v = await verifyApprovalToken(process.env.HITL_SIGNING_KEY || '', token);
  if (!v.ok) return c.json({ error: 'Forbidden', message: v.reason }, 403);

  const { runId, decision, organizationId } = v.claims!;
  const own = await assertRunOwnership({ sql }, runId, organizationId);
  if (!own.ok) return c.json({ error: 'Forbidden', message: own.reason }, own.status as any);

  return emitDecision(c, runId, decision, organizationId);
});

async function emitDecision(c: any, runId: string, decision: 'approve' | 'reject', organizationId: string) {
  await inngest.send({
    name: 'agent/run.approve',
    data: { runId, decision, organizationId },
  });
  if (sql) {
    await sql`
      UPDATE background_agent_runs
      SET status = ${decision === 'approve' ? 'running' : 'killed'}, updated_at = NOW()
      WHERE run_id = ${runId} AND organization_id = ${organizationId}
    `.catch(() => null);
  }
  return c.json({ ok: true, runId, decision });
}

/**
 * POST /api/agent/cancel
 * Emergency termination of a runaway background agent.
 */
app.post('/cancel', async (c) => {
  const auth = await getAuthContext(c);
  if (auth.error) return c.json({ error: 'Unauthorized', message: auth.error }, auth.status as any);

  try {
    const body = (await c.req.json().catch(() => ({}))) || {};
    if (!body.runId) return c.json({ error: 'runId required' }, 400);
    if (!isValidRunId(String(body.runId))) return c.json({ error: 'Bad Request', message: 'invalid runId' }, 400);

    // Same object-level check as approve: the kill switch must not reach
    // another tenant's run.
    const own = await assertRunOwnership({ sql }, String(body.runId), auth.keyContext?.organizationId);
    if (!own.ok) return c.json({ error: 'Forbidden', message: own.reason }, own.status as any);

    await inngest.send({
      name: 'agent/run.cancel',
      data: { runId: String(body.runId), organizationId: own.organizationId, reason: body.reason || 'User cancelled' },
    });

    if (sql) {
      await sql`
        UPDATE background_agent_runs
        SET status = 'killed', updated_at = NOW()
        WHERE run_id = ${body.runId} AND organization_id = ${own.organizationId}
      `.catch(() => null);
    }

    return c.json({ ok: true, runId: body.runId, status: 'killed' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
