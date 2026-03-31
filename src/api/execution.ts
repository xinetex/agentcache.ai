import { Hono } from 'hono';
import { z } from 'zod';
import { authenticateAdmin, authenticateApiKey } from '../middleware/auth.js';
import { executionControlService } from '../services/ExecutionControlService.js';
import { executionDriftService } from '../services/ExecutionDriftService.js';
import { sharedReceiptService } from '../services/SharedReceiptService.js';

const executionRouter = new Hono();

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
  note: z.string().optional(),
  decidedBy: z.string().optional(),
});

const phaseSchema = z.object({
  phase: z.string().min(1),
});

const evaluationSchema = z.object({
  mode: z.enum(['shadow']).optional(),
});

executionRouter.get('/context-packs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const packs = await executionControlService.listContextPacks(Number(c.req.query('limit') || 25));
  return c.json({ success: true, packs });
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

    const result = await executionControlService.createContextPack(parsed.data, {
      principalId: (c as any).get?.('principalId') || undefined,
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

  const pack = await executionControlService.getContextPack(c.req.param('id'));
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
    const body = await c.req.json();
    const parsed = contextPackVersionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await executionControlService.addContextPackVersion(c.req.param('id'), parsed.data, {
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

    const result = await executionControlService.startRun(parsed.data, {
      principalId: (c as any).get?.('principalId') || undefined,
    });

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
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

executionRouter.get('/runs/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const bundle = await executionControlService.getRunBundle(c.req.param('id'));
  if (!bundle) {
    return c.json({ error: 'Execution run not found.' }, 404);
  }

  return c.json({ success: true, ...bundle });
});

executionRouter.get('/runs/:id/evaluations', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const run = await executionControlService.getRun(c.req.param('id'));
  if (!run) {
    return c.json({ error: 'Execution run not found.' }, 404);
  }

  const evaluations = await executionDriftService.listRunEvaluations(run.id, Number(c.req.query('limit') || 25));
  return c.json({ success: true, evaluations });
});

executionRouter.post('/runs/:id/evaluate', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = evaluationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const evaluation = await executionDriftService.evaluateRun(c.req.param('id'), parsed.data.mode || 'shadow');
    return c.json({ success: true, evaluation }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to evaluate execution drift.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

executionRouter.post('/runs/:id/reviews', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await executionControlService.recordReview({
      runId: c.req.param('id'),
      ...parsed.data,
    });

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
    const body = await c.req.json();
    const parsed = phaseSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const run = await executionControlService.advancePhase({
      runId: c.req.param('id'),
      phase: parsed.data.phase,
    });

    return c.json({ success: true, run });
  } catch (error: any) {
    const message = error?.message || 'Failed to advance workflow phase.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 400);
  }
});

executionRouter.post('/gates/:id/approve', async (c) => {
  const authError = await authenticateAdmin(c);
  if (authError) return authError;

  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = gateDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await executionControlService.decideGate({
      gateId: c.req.param('id'),
      decision: 'approved',
      decidedBy: parsed.data.decidedBy || 'admin',
      note: parsed.data.note,
    });

    await sharedReceiptService.ingest(result.receipt, {
      principalId: parsed.data.decidedBy || 'admin',
    }).catch(() => null);

    return c.json({ success: true, gate: result.gate, run: result.run, receipt: result.receipt });
  } catch (error: any) {
    const message = error?.message || 'Failed to approve gate.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

executionRouter.post('/gates/:id/reject', async (c) => {
  const authError = await authenticateAdmin(c);
  if (authError) return authError;

  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = gateDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await executionControlService.decideGate({
      gateId: c.req.param('id'),
      decision: 'rejected',
      decidedBy: parsed.data.decidedBy || 'admin',
      note: parsed.data.note,
    });

    await sharedReceiptService.ingest(result.receipt, {
      principalId: parsed.data.decidedBy || 'admin',
    }).catch(() => null);

    return c.json({ success: true, gate: result.gate, run: result.run, receipt: result.receipt });
  } catch (error: any) {
    const message = error?.message || 'Failed to reject gate.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

export default executionRouter;
