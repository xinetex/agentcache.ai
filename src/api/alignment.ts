import { Hono } from 'hono';
import { z } from 'zod';
import { authenticateAdmin, authenticateApiKey } from '../middleware/auth.js';
import { alignmentRoutingService } from '../services/AlignmentRoutingService.js';
import { modelCompatibilityLabService } from '../services/ModelCompatibilityLabService.js';
import { alignmentPersistenceService } from '../services/AlignmentPersistenceService.js';
import { sharedReceiptService } from '../services/SharedReceiptService.js';

const alignmentRouter = new Hono();

const scoreSchema = z.object({
  sourceProvider: z.string().optional(),
  sourceModel: z.string().optional(),
  targetProvider: z.string().optional(),
  targetModel: z.string().optional(),
  taskFamily: z.enum(['classification', 'extraction', 'reranking', 'retrieval', 'embedding', 'generation']),
  privacyMode: z.enum(['plaintext', 'aligned', 'encrypted_linear']).optional(),
  sensitivity: z.enum(['public', 'internal', 'regulated', 'restricted']).optional(),
});

const routeSchema = z.object({
  prompt: z.string().optional(),
  values: z.array(z.unknown()).optional(),
  taskFamily: z.enum(['classification', 'extraction', 'reranking', 'retrieval', 'embedding', 'generation']),
  sectorHint: z.string().optional(),
  sourceProvider: z.string().optional(),
  sourceModel: z.string().optional(),
  preferredProvider: z.string().optional(),
  allowedProviders: z.array(z.string()).optional(),
  privacyMode: z.enum(['plaintext', 'aligned', 'encrypted_linear']).optional(),
  sensitivity: z.enum(['public', 'internal', 'regulated', 'restricted']).optional(),
  tierId: z.string().optional(),
});

const benchmarkSchema = z.object({
  pairId: z.string().min(1),
  sourceProvider: z.string().min(1),
  sourceModel: z.string().optional(),
  targetProvider: z.string().min(1),
  targetModel: z.string().optional(),
  taskFamily: z.enum(['classification', 'extraction', 'reranking', 'retrieval', 'embedding', 'generation']),
  dataset: z.string().optional(),
  baselineScore: z.number().optional(),
  alignedScore: z.number().optional(),
  degradationPct: z.number().optional(),
  latencyMs: z.number().optional(),
  costUsd: z.number().optional(),
  notes: z.array(z.string()).optional(),
  status: z.enum(['recorded', 'validated', 'rejected']).optional(),
});

const pairSchema = z.object({
  id: z.string().min(1),
  sourceProvider: z.string().min(1),
  sourceModel: z.string().optional().nullable(),
  targetProvider: z.string().min(1),
  targetModel: z.string().optional().nullable(),
  taskFamily: z.enum(['classification', 'extraction', 'reranking', 'retrieval', 'embedding', 'generation']),
  status: z.enum(['estimated', 'validated', 'blocked']),
  compatibilityScore: z.number().min(0).max(1),
  tokenizerCompatibility: z.number().min(0).max(1),
  representationSimilarity: z.number().min(0).max(1),
  privateInferenceCapable: z.boolean(),
  evidenceLevel: z.enum(['heuristic-v1', 'validated-v1']),
  notes: z.array(z.string()).optional(),
  updatedBy: z.string().optional(),
});

const pairPatchSchema = pairSchema.partial().omit({ id: true }).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required.',
});

alignmentRouter.get('/pairs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  return c.json({
    success: true,
    pairs: await modelCompatibilityLabService.listPairs({
      sourceProvider: c.req.query('sourceProvider'),
      targetProvider: c.req.query('targetProvider'),
      taskFamily: (c.req.query('taskFamily') || null) as any,
      includeBlocked: c.req.query('includeBlocked') === 'true',
    }),
  });
});

alignmentRouter.post('/pairs', async (c) => {
  const authError = await authenticateAdmin(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = pairSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const pair = await alignmentPersistenceService.upsertPair(parsed.data, {
      updatedBy: parsed.data.updatedBy || 'admin',
    });

    return c.json({
      success: true,
      pair,
    }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to persist alignment pair.' }, 500);
  }
});

alignmentRouter.patch('/pairs/:pairId', async (c) => {
  const authError = await authenticateAdmin(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = pairPatchSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const pairId = c.req.param('pairId');
    const current = await alignmentPersistenceService.getEffectivePairById(pairId);

    if (!current) {
      return c.json({ error: 'Alignment pair not found.' }, 404);
    }

    const pair = await alignmentPersistenceService.upsertPair({
      ...current,
      ...parsed.data,
      id: pairId,
      notes: parsed.data.notes || current.notes,
    }, {
      updatedBy: parsed.data.updatedBy || 'admin',
    });

    return c.json({
      success: true,
      pair,
    });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to update alignment pair.' }, 500);
  }
});

alignmentRouter.get('/summary', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const summary = await alignmentPersistenceService.getSummary();
    return c.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to load alignment summary.' }, 500);
  }
});

alignmentRouter.get('/runs/:requestId', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const run = await alignmentPersistenceService.getRun(c.req.param('requestId'));
    if (!run) {
      return c.json({ error: 'Alignment run not found.' }, 404);
    }
    return c.json({
      success: true,
      run,
    });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to load alignment run.' }, 500);
  }
});

alignmentRouter.get('/benchmarks', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const benchmarks = await alignmentPersistenceService.listBenchmarks(Number(c.req.query('limit') || 25));
    return c.json({
      success: true,
      benchmarks,
    });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to list alignment benchmarks.' }, 500);
  }
});

alignmentRouter.post('/score', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = scoreSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const report = await modelCompatibilityLabService.score(parsed.data);
    return c.json({
      success: true,
      report,
    }, report.verdict === 'BLOCK' ? 409 : 200);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to score provider compatibility.' }, 500);
  }
});

alignmentRouter.post('/route', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = routeSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const decision = await alignmentRoutingService.route(parsed.data);
    await Promise.all([
      alignmentPersistenceService.recordRun(decision, {
        principalId: (c as any).get?.('principalId') || undefined,
      }),
      sharedReceiptService.ingest(decision.receipt, {
        apiKey: (c as any).get?.('apiKey') || undefined,
        principalId: (c as any).get?.('principalId') || undefined,
      }).catch(() => null),
    ]);

    return c.json({
      success: true,
      decision,
    }, decision.executionMode === 'blocked' ? 409 : 200);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to route alignment request.' }, 500);
  }
});

alignmentRouter.post('/benchmarks', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = benchmarkSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const benchmark = await alignmentPersistenceService.recordBenchmark(parsed.data);
    return c.json({
      success: true,
      benchmark,
    }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to record alignment benchmark.' }, 500);
  }
});

export default alignmentRouter;
