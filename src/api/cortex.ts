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
  cortexRuntimeService,
  type CortexCreateGoalInput,
  type CortexCreatePlanInput,
  type CortexMemorySearchInput,
  type CortexReflectInput,
  type CortexRunCycleInput,
} from '../services/CortexRuntimeService.js';
import {
  cortexEvolutionService,
  type CreateEvolutionRunInput,
  type ProposeEvolutionCandidateInput,
  type RecordEvolutionEvaluationInput,
} from '../services/CortexEvolutionService.js';

const cortexRouter = new Hono();

const textArray = z.array(z.string().min(1)).max(50).optional();

const goalSchema = z.object({
  objective: z.string().min(1),
  sectorHint: z.string().optional(),
  orgId: z.string().optional(),
  actorId: z.string().optional(),
  constraints: textArray,
  successCriteria: textArray,
  preferredTools: textArray,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const planSchema = z.object({
  prompt: z.string().optional(),
  mode: z.enum(['shadow', 'advisory', 'execute']).optional(),
  tools: textArray,
  finalAction: z.enum(['publish', 'send', 'pay', 'delete', 'external_store', 'manual']).optional(),
  requireHumanGate: z.boolean().optional(),
  memoryTopK: z.number().int().positive().max(10).optional(),
});

const toolRunSchema = z.object({
  stepId: z.string().optional(),
  tool: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  mode: z.enum(['propose', 'simulate', 'approved']).optional(),
  approvalToken: z.string().optional(),
  reversible: z.boolean().optional(),
});

const reflectSchema = z.object({
  goalId: z.string().min(1),
  planId: z.string().optional(),
  outcome: z.enum(['success', 'partial', 'failure', 'blocked']),
  summary: z.string().min(1),
  facts: textArray,
  procedures: textArray,
  failures: textArray,
  preferences: textArray,
  confidence: z.number().min(0).max(1).optional(),
  completeGoal: z.boolean().optional(),
});

const memorySearchSchema = z.object({
  query: z.string().optional(),
  goalId: z.string().optional(),
  orgId: z.string().optional(),
  kinds: z.array(z.enum(['episode', 'belief', 'procedure', 'failure', 'preference'])).optional(),
  tags: textArray,
  limit: z.number().int().positive().max(100).optional(),
  semanticTopK: z.number().int().positive().max(10).optional(),
});

const cycleSchema = goalSchema.extend({
  prompt: z.string().optional(),
  mode: z.enum(['shadow', 'advisory', 'execute']).optional(),
  tools: textArray,
  finalAction: z.enum(['publish', 'send', 'pay', 'delete', 'external_store', 'manual']).optional(),
  requireHumanGate: z.boolean().optional(),
  reflection: reflectSchema.omit({ goalId: true, planId: true }).optional(),
});

const evolutionRunSchema = z.object({
  objective: z.string().min(1),
  goalId: z.string().optional(),
  parentCommit: z.string().optional(),
  sourceRepository: z.string().url().optional(),
  mode: z.enum(['shadow', 'sandbox']).optional(),
  maxGenerations: z.number().int().positive().max(80).optional(),
  candidatesPerGeneration: z.number().int().positive().max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const evolutionCandidateSchema = z.object({
  summary: z.string().min(1),
  patchDigest: z.string().optional(),
  changedFiles: z.array(z.string().min(1)).min(1).max(200),
  patchBytes: z.number().int().nonnegative().optional(),
  parentCandidateId: z.string().optional(),
  branchName: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const benchmarkResultSchema = z.object({
  id: z.string().min(1),
  command: z.string().optional(),
  status: z.enum(['passed', 'failed', 'skipped']),
  required: z.boolean().optional(),
  durationMs: z.number().nonnegative().optional(),
  exitCode: z.number().int().optional(),
  summary: z.string().optional(),
  artifactRef: z.string().optional(),
});

const evolutionEvaluationSchema = z.object({
  benchmarkResults: z.array(benchmarkResultSchema).min(1).max(50),
  notes: textArray,
});

function authContext(c: any) {
  return {
    apiKey: c.get?.('apiKey') || undefined,
    principalId: c.get?.('principalId') || c.get?.('principalAgentId') || undefined,
  };
}

cortexRouter.get('/', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  return c.json({
    success: true,
    blueprint: {
      ...cortexRuntimeService.getBlueprint(),
      evolution: cortexEvolutionService.getBlueprint(),
    },
  });
});

cortexRouter.get('/evolution/blueprint', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  return c.json({
    success: true,
    blueprint: cortexEvolutionService.getBlueprint(),
  });
});

cortexRouter.get('/evolution/runs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const runs = await cortexEvolutionService.listRuns(Number(c.req.query('limit') || 25));
  return c.json({ success: true, runs });
});

cortexRouter.post('/evolution/runs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = evolutionRunSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const run = await cortexEvolutionService.createRun(parsed.data as CreateEvolutionRunInput, authContext(c));
    return c.json({ success: true, run }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to create Cortex evolution run.' }, 500);
  }
});

cortexRouter.get('/evolution/runs/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const run = await cortexEvolutionService.getRun(c.req.param('id'));
  if (!run) return c.json({ error: 'Cortex evolution run not found.' }, 404);
  const candidates = await cortexEvolutionService.listRunCandidates(run.id, Number(c.req.query('limit') || 25));
  return c.json({ success: true, run, candidates });
});

cortexRouter.post('/evolution/runs/:id/candidates', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = evolutionCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const candidate = await cortexEvolutionService.proposeCandidate({
      ...parsed.data,
      runId: c.req.param('id'),
    } as ProposeEvolutionCandidateInput, authContext(c));
    return c.json({ success: true, candidate }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to propose Cortex evolution candidate.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

cortexRouter.post('/evolution/runs/:id/candidates/:candidateId/evaluations', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = evolutionEvaluationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await cortexEvolutionService.recordEvaluation({
      ...parsed.data,
      runId: c.req.param('id'),
      candidateId: c.req.param('candidateId'),
    } as RecordEvolutionEvaluationInput, authContext(c));
    return c.json({ success: true, ...result }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to record Cortex evolution evaluation.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

cortexRouter.get('/goals', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const goals = await cortexRuntimeService.listGoals(Number(c.req.query('limit') || 25));
  return c.json({ success: true, goals });
});

cortexRouter.post('/goals', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = goalSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const goal = await cortexRuntimeService.createGoal(parsed.data as CortexCreateGoalInput, authContext(c));
    return c.json({ success: true, goal }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to create Cortex goal.' }, 500);
  }
});

cortexRouter.post('/goals/:id/plan', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const plan = await cortexRuntimeService.createPlan({
      ...parsed.data,
      goalId: c.req.param('id'),
    } as CortexCreatePlanInput, authContext(c));

    return c.json({ success: true, plan }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to create Cortex plan.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

cortexRouter.get('/goals/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const goal = await cortexRuntimeService.getGoal(c.req.param('id'));
  if (!goal) return c.json({ error: 'Cortex goal not found.' }, 404);
  return c.json({ success: true, goal });
});

cortexRouter.get('/plans/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const plan = await cortexRuntimeService.getPlan(c.req.param('id'));
  if (!plan) return c.json({ error: 'Cortex plan not found.' }, 404);
  return c.json({ success: true, plan });
});

cortexRouter.post('/plans/:id/tools', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = toolRunSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const toolRun = await cortexRuntimeService.proposeToolRun({
      ...parsed.data,
      planId: c.req.param('id'),
    });
    return c.json({ success: true, toolRun }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to propose Cortex tool run.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

cortexRouter.post('/reflect', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = reflectSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const result = await cortexRuntimeService.reflect(parsed.data as CortexReflectInput);
    return c.json({ success: true, ...result }, 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to reflect Cortex outcome.';
    return c.json({ error: message }, message.includes('not found') ? 404 : 500);
  }
});

cortexRouter.post('/memory/search', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = memorySearchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const memory = await cortexRuntimeService.searchMemory(parsed.data as CortexMemorySearchInput);
    return c.json({ success: true, memory });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to search Cortex memory.' }, 500);
  }
});

cortexRouter.post('/cycles', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const parsed = cycleSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const cycle = await cortexRuntimeService.runCycle(parsed.data as CortexRunCycleInput, authContext(c));
    return c.json({ success: true, cycle }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to run Cortex cycle.' }, 500);
  }
});

export default cortexRouter;
