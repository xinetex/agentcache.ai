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
import { authenticateApiKey } from '../middleware/auth.js';
import { cognitiveMemory } from '../services/cognitive-memory.js';

const cognitiveRouter = new Hono();

cognitiveRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'cognitive',
    features: [
      'predictive_synapse',
      'drift_walker',
      'neural_evolution',
      'fleet_learning',
    ],
    timestamp: new Date().toISOString(),
  });
});

cognitiveRouter.get('/status', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  return c.json(await cognitiveMemory.getStatus());
});

cognitiveRouter.post('/predict', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const body = await c.req.json().catch(() => ({} as any));
  const query = typeof body.query === 'string' ? body.query : '';
  const previousQuery =
    typeof body.previous_query === 'string' ? body.previous_query : undefined;
  const depth = Number.isFinite(Number(body.depth))
    ? Math.max(1, Math.min(3, Math.floor(Number(body.depth))))
    : 1;

  if (!query || query.trim().length < 2) {
    return c.json({ error: 'query is required (min 2 chars)' }, 400);
  }

  await cognitiveMemory.observeTransition(previousQuery, query);
  const predictions = await cognitiveMemory.predictNext(query, depth);

  return c.json({
    success: true,
    query,
    predictions,
  });
});

cognitiveRouter.post('/drift', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const body = await c.req.json().catch(() => ({} as any));
  const id = typeof body.id === 'string' ? body.id : '';
  const heal = body.heal === true;

  if (!id) {
    return c.json({ error: 'id is required' }, 400);
  }

  const assessment = await cognitiveMemory.assessDrift(id, heal);
  return c.json({
    success: true,
    id,
    ...assessment,
  });
});

cognitiveRouter.post('/evolve', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const body = await c.req.json().catch(() => ({} as any));
  const generations = Number.isFinite(Number(body.generations))
    ? Math.max(1, Math.min(25, Math.floor(Number(body.generations))))
    : 1;
  const populationSize = Number.isFinite(Number(body.populationSize))
    ? Math.max(4, Math.min(32, Math.floor(Number(body.populationSize))))
    : 8;

  const result = await cognitiveMemory.evolveStrategy(generations, populationSize);
  return c.json({
    success: true,
    ...result,
  });
});

cognitiveRouter.post('/fleet/sync', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const body = await c.req.json().catch(() => ({} as any));
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : '';
  const memories = Array.isArray(body.memories) ? body.memories : [];

  if (!nodeId) {
    return c.json({ error: 'nodeId is required' }, 400);
  }

  const result = await cognitiveMemory.mergeFleetMemories(nodeId, memories);
  return c.json({
    success: true,
    ...result,
  });
});

export default cognitiveRouter;
