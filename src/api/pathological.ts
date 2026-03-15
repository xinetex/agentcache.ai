import { Hono } from 'hono';
import { z } from 'zod';
import { authenticateApiKey } from '../middleware/auth.js';
import { pathologicalAssessmentService } from '../services/PathologicalAssessmentService.js';
import { sharedReceiptService } from '../services/SharedReceiptService.js';

type Variables = {
  apiKey: string;
  principalId?: string;
};

const sectorSchema = z.enum(['finance', 'healthcare', 'legal', 'biotech', 'robotics', 'energy']);
const severitySchema = z.enum(['low', 'medium', 'high', 'critical']);
const errorKindSchema = z.enum([
  'schema_violation',
  'missing_field',
  'inconsistent_ontology',
  'stale_signal',
  'downstream_dependency',
]);
const provocationTypeSchema = z.enum(['INPUT', 'INFRASTRUCTURE', 'COGNITIVE']);

const assessmentSchema = z.object({
  targetAgentId: z.string().min(1),
  profileId: z.string().min(1).optional(),
  sector: sectorSchema,
  ttlMs: z.number().int().positive().optional(),
  eventAgeMs: z.number().int().min(0).optional(),
  errorKind: errorKindSchema.optional(),
  previousAttempts: z.number().int().min(0).optional(),
  maxAllowedAttempts: z.number().int().min(1).optional(),
  severity: severitySchema.optional(),
  provocation: z.object({
    type: provocationTypeSchema,
    severity: z.number().min(0).max(1),
    target: z.string().min(1).optional(),
    durationMs: z.number().int().positive().optional(),
  }).optional(),
});

const router = new Hono<{ Variables: Variables }>();

router.get('/profiles', async (c) => {
  const profiles = await pathologicalAssessmentService.listProfiles();
  return c.json({
    success: true,
    profiles,
  });
});

router.post('/assess', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const input = assessmentSchema.parse(body);
    const result = await pathologicalAssessmentService.assess(input, {
      apiKey: c.get('apiKey'),
      principalId: c.get('principalId'),
    });

    return c.json({
      success: true,
      receiptId: result.receiptId,
      duelId: result.duelId,
      profile: result.profile,
      recoveryPlan: result.recoveryPlan,
      receipt: result.storedReceipt.receipt,
      signatureStatus: result.storedReceipt.signatureStatus,
    }, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({
        error: 'Invalid assessment request.',
        issues: err.issues,
      }, 400);
    }

    return c.json({ error: err?.message || 'Failed to run pathological assessment.' }, 500);
  }
});

router.get('/runs/:receiptId', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const stored = await sharedReceiptService.get(c.req.param('receiptId'));
  if (!stored || stored.receipt.subject.kind !== 'PATHOLOGY_RUN') {
    return c.json({ error: 'Pathology run not found.' }, 404);
  }

  return c.json({
    success: true,
    run: stored,
  });
});

router.get('/summary', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const summary = await sharedReceiptService.getSummary({
    subjectKind: 'PATHOLOGY_RUN',
    sectorId: c.req.query('sectorId'),
    verdict: c.req.query('verdict'),
    limit: Number(c.req.query('limit') || 100),
  });

  return c.json({
    success: true,
    summary,
  });
});

export default router;
