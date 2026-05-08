/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authenticateApiKey } from '../middleware/auth.js';
import {
  cognitiveRuntimeService,
  type CognitiveRuntimeInput,
} from '../services/CognitiveRuntimeService.js';

const runtimeRouter = new Hono();

const runtimeInputSchema = z.object({
  input: z.union([z.string().min(1), z.record(z.string(), z.unknown())]),
  objective: z.string().optional(),
  sessionId: z.string().optional(),
  orgId: z.string().optional(),
  actorId: z.string().optional(),
  contextPackId: z.string().optional(),
  mode: z.enum(['shadow', 'plan', 'answer', 'execute']).optional(),
  sectorHint: z.string().optional(),
  tierId: z.string().optional(),
  verticalSku: z.string().optional(),
  taskType: z.string().optional(),
  tools: z.array(z.string()).optional(),
  events: z.array(z.record(z.string(), z.unknown())).optional(),
  finalAction: z.enum(['publish', 'send', 'pay', 'delete', 'external_store', 'manual']).optional(),
  requireHumanGate: z.boolean().optional(),
  executeModel: z.boolean().optional(),
  executeTools: z.boolean().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(384000).optional(),
  privacyMode: z.enum(['standard', 'redacted', 'ephemeral']).optional(),
  memory: z.object({
    topK: z.number().int().positive().max(10).optional(),
    namespace: z.string().optional(),
    structure: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  learning: z.object({
    writeBack: z.boolean().optional(),
  }).optional(),
});

runtimeRouter.get('/', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  return c.json({
    success: true,
    service: 'cognitive-runtime',
    stages: [
      'perception',
      'state',
      'memory',
      'world_model',
      'planner',
      'reasoning',
      'tools',
      'verifier',
      'learning',
    ],
    defaultMode: 'shadow',
  });
});

runtimeRouter.get('/runs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const runs = await cognitiveRuntimeService.listRecent(Number(c.req.query('limit') || 25));
  return c.json({ success: true, runs });
});

runtimeRouter.post('/runs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = runtimeInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await cognitiveRuntimeService.run(parsed.data as CognitiveRuntimeInput, {
      apiKey: (c as any).get?.('apiKey') || undefined,
      principalId: (c as any).get?.('principalId') || undefined,
    });

    return c.json({ success: true, result }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to run cognitive runtime.' }, 500);
  }
});

runtimeRouter.post('/plan', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = runtimeInputSchema.safeParse({ ...body, mode: body?.mode || 'plan', executeModel: false, executeTools: false });
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await cognitiveRuntimeService.run(parsed.data as CognitiveRuntimeInput, {
      apiKey: (c as any).get?.('apiKey') || undefined,
      principalId: (c as any).get?.('principalId') || undefined,
    });

    return c.json({ success: true, result }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to plan cognitive runtime run.' }, 500);
  }
});

runtimeRouter.get('/runs/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const run = await cognitiveRuntimeService.getRun(c.req.param('id'));
  if (!run) {
    return c.json({ error: 'Cognitive runtime run not found.' }, 404);
  }

  return c.json({ success: true, run });
});

export default runtimeRouter;
