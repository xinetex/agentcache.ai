import { Hono } from 'hono';
import { z } from 'zod';
import { authenticateApiKey } from '../middleware/auth.js';
import { externalAgentRegistrationService } from '../services/ExternalAgentRegistrationService.js';
import { soulprintService } from '../services/SoulprintService.js';

type Variables = {
  apiKey: string;
  principalId?: string;
};

const registrationSchema = z.object({
  externalSystem: z.enum(['moltbook', 'generic']),
  externalAgentId: z.string().min(1),
  displayName: z.string().min(1),
  profileUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const verificationSchema = z.object({
  ownershipProof: z.string().min(1),
});

const soulprintSchema = z.object({
  sector: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().optional(),
  sources: z.array(z.object({
    kind: z.string().min(1),
    ref: z.string().min(1),
    excerpt: z.string().optional(),
  })).min(1).optional(),
  findings: z.array(z.object({
    category: z.string().min(1),
    summary: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high']).optional(),
  })).min(1).optional(),
  biasFlags: z.array(z.string().min(1)).optional(),
  topology: z.object({
    escalationBias: z.number().min(0).max(1).optional(),
    recencyBias: z.number().min(0).max(1).optional(),
    authorityBias: z.number().min(0).max(1).optional(),
    explorationBias: z.number().min(0).max(1).optional(),
  }).optional(),
  artifacts: z.array(z.object({
    kind: z.string().min(1),
    ref: z.string().min(1),
    content: z.string().min(1),
  })).optional(),
}).superRefine((value, ctx) => {
  const hasManual = Array.isArray(value.sources) && value.sources.length > 0
    && Array.isArray(value.findings) && value.findings.length > 0;
  const hasArtifacts = Array.isArray(value.artifacts) && value.artifacts.length > 0;

  if (!hasManual && !hasArtifacts) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either sources+findings or artifacts for Soulprint scanning.',
      path: ['artifacts'],
    });
  }
});

const router = new Hono<{ Variables: Variables }>();

function requirePrincipalId(c: any): string {
  return c.get('principalId') || `api_key:${c.get('apiKey')}`;
}

router.get('/', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const registrations = await externalAgentRegistrationService.listByOwner(requirePrincipalId(c));
  return c.json({
    success: true,
    registrations,
  });
});

router.get('/summary', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const summary = await externalAgentRegistrationService.getSummary(requirePrincipalId(c));
  return c.json({
    success: true,
    summary,
  });
});

router.post('/register', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = registrationSchema.parse(await c.req.json());
    const result = await externalAgentRegistrationService.register({
      ...body,
      ownerPrincipalId: requirePrincipalId(c),
    });

    return c.json({
      success: true,
      duplicate: result.duplicate,
      registration: result.registration,
    }, result.duplicate ? 200 : 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid external agent registration payload.', issues: err.issues }, 400);
    }
    return c.json({ error: err?.message || 'Failed to register external agent.' }, 500);
  }
});

router.get('/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const registration = await externalAgentRegistrationService.get(c.req.param('id'));
  if (!registration) {
    return c.json({ error: 'External agent registration not found.' }, 404);
  }
  if (registration.ownerPrincipalId !== requirePrincipalId(c)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  return c.json({
    success: true,
    registration,
  });
});

router.get('/:id/soulprint/report', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const report = await externalAgentRegistrationService.getSoulprintReport(
      c.req.param('id'),
      requirePrincipalId(c),
    );

    return c.json({
      success: true,
      registration: report.registration,
      soulprint: report.soulprint,
      receipt: report.storedReceipt?.receipt || null,
      signatureStatus: report.storedReceipt?.signatureStatus || null,
    });
  } catch (err: any) {
    const message = err?.message || 'Failed to load Soulprint report.';
    const status = message.includes('not found') ? 404 : message.includes('own this') ? 403 : 500;
    return c.json({ error: message }, status);
  }
});

router.post('/:id/verify', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = verificationSchema.parse(await c.req.json());
    const registration = await externalAgentRegistrationService.verifyExternalOwnership({
      id: c.req.param('id'),
      ownerPrincipalId: requirePrincipalId(c),
      ownershipProof: body.ownershipProof,
    });

    return c.json({
      success: true,
      registration,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid verification payload.', issues: err.issues }, 400);
    }
    const message = err?.message || 'Failed to verify external agent ownership.';
    const status = message.includes('not found') ? 404 : message.includes('own this') ? 403 : 400;
    return c.json({ error: message }, status);
  }
});

router.post('/:id/moltbook-verify', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = z.object({ profileUrl: z.string().url() }).parse(await c.req.json());
    const registration = await externalAgentRegistrationService.verifyExternalOwnership({
      id: c.req.param('id'),
      ownerPrincipalId: requirePrincipalId(c),
      profileUrl: body.profileUrl,
    });

    return c.json({
      success: true,
      registration,
    });
  } catch (err: any) {
    const message = err?.message || 'Failed to verify Moltbook ownership.';
    const status = message.includes('not found') ? 404 : message.includes('own this') ? 403 : 400;
    return c.json({ error: message }, status);
  }
});

router.post('/:id/soulprint', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = soulprintSchema.parse(await c.req.json());
    const resolvedSoulprint = Array.isArray(body.artifacts) && body.artifacts.length > 0
      ? soulprintService.scanArtifacts({
          artifacts: body.artifacts,
          sector: body.sector,
          summary: body.summary,
          findings: body.findings,
          biasFlags: body.biasFlags,
          topology: body.topology,
        })
      : {
          sector: body.sector,
          confidence: body.confidence,
          summary: body.summary,
          sources: body.sources || [],
          findings: body.findings || [],
          biasFlags: body.biasFlags,
          topology: body.topology,
        };
    const result = await externalAgentRegistrationService.attachSoulprint({
      registrationId: c.req.param('id'),
      ownerPrincipalId: requirePrincipalId(c),
      apiKey: c.get('apiKey'),
      soulprint: resolvedSoulprint,
    });

    return c.json({
      success: true,
      duplicate: result.duplicate,
      registration: result.registration,
      receiptId: result.storedReceipt.receipt.receiptId,
      signatureStatus: result.storedReceipt.signatureStatus,
      soulprint: resolvedSoulprint,
      receipt: result.storedReceipt.receipt,
    }, result.duplicate ? 200 : 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid soulprint payload.', issues: err.issues }, 400);
    }
    const message = err?.message || 'Failed to attach Soulprint.';
    const status = message.includes('not found') ? 404 : message.includes('own this') ? 403 : 500;
    return c.json({ error: message }, status);
  }
});

export default router;
