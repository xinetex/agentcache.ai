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
import {
  advancedServicesService,
  type AdvancedServicesBlueprintInput,
} from '../services/AdvancedServicesService.js';
import { executionDriftService } from '../services/ExecutionDriftService.js';
import { memoryFabricAnalyticsService } from '../services/MemoryFabricAnalyticsService.js';
import { sharedReceiptService } from '../services/SharedReceiptService.js';
import { statsService } from '../services/StatsService.js';
import {
  getQueueLength,
  getRecentTranscodeJobs,
  getTranscodeProfiles,
} from '../services/transcode-queue.js';

const advancedServicesRouter = new Hono();
const SIGNAL_TIMEOUT_MS = Number(process.env.ADVANCED_SERVICES_SIGNAL_TIMEOUT_MS || 1500);

const blueprintSchema = z.object({
  objective: z.string().min(1).max(4000),
  sector: z.string().max(80).optional(),
  autonomy: z.enum(['shadow', 'copilot', 'autonomous']).optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  systems: z.array(z.string().min(1).max(120)).max(20).optional(),
  painPoints: z.array(z.string().min(1).max(180)).max(20).optional(),
  currentStack: z.array(z.string().min(1).max(120)).max(20).optional(),
  regulated: z.boolean().optional(),
});

async function withSignalFallback<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), SIGNAL_TIMEOUT_MS)),
    ]);
  } catch (error: any) {
    console.warn(`[AdvancedServices] Failed to load ${label}:`, error?.message || error);
    return fallback;
  }
}

function numberValue(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function metric(label: string, value: number | string, unit?: string) {
  return { label, value, unit: unit || null };
}

function sumSubjectKinds(items: Array<{ kind?: string; count?: number }> = [], terms: string[]) {
  return items
    .filter((item) => terms.some((term) => String(item.kind || '').toUpperCase().includes(term)))
    .reduce((sum, item) => sum + numberValue(item.count), 0);
}

advancedServicesRouter.get('/', (c) => {
  return c.json({
    success: true,
    service: 'advanced-services',
    thesis: 'Workflow Memory Fabric plus Reliability Mesh plus DecisionRail is the product stack for enterprise agent adoption.',
    endpoints: [
      'GET /api/advanced-services/catalog',
      'GET /api/advanced-services/signals',
      'GET /api/advanced-services/:id',
      'POST /api/advanced-services/blueprint',
    ],
  });
});

advancedServicesRouter.get('/catalog', (c) => {
  return c.json({
    success: true,
    services: advancedServicesService.getCatalog(),
  });
});

advancedServicesRouter.get('/signals', async (c) => {
  const now = new Date().toISOString();
  const emptyFabric = {
    summary: {
      totalOperations: 0,
      reads: 0,
      writes: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      estimatedTokensSaved: 0,
      estimatedUsdSaved: 0,
      estimatedLatencySavedMs: 0,
      evidenceCoverageRate: 0,
    },
    bySku: [],
    bySector: [],
  };
  const emptyDrift = {
    totalEvaluations: 0,
    stableEvaluations: 0,
    watchEvaluations: 0,
    driftingEvaluations: 0,
    averageSurpriseScore: 0,
    recentEvaluations: [],
  };
  const emptyReceipts = {
    total: 0,
    bySubjectKind: [],
    byVerdict: [],
    bySector: [],
    browser: { proofs: 0 },
  };

  const [stats, fabric, drift, receipts, queueLength, recentJobs] = await Promise.all([
    withSignalFallback(statsService.getGlobalStats(), {
      cache_hit_rate: 0,
      cache_hits_today: 0,
      cache_misses_today: 0,
      cost_savings_usd: 0,
      cost_saved_today: '$0.00',
    } as any, 'stats'),
    withSignalFallback(memoryFabricAnalyticsService.getSnapshot(), emptyFabric as any, 'memory fabric analytics'),
    withSignalFallback(executionDriftService.getSummary(5), emptyDrift as any, 'execution drift'),
    withSignalFallback(sharedReceiptService.getSummary(), emptyReceipts as any, 'shared receipts'),
    withSignalFallback(getQueueLength(), 0, 'media queue length'),
    withSignalFallback(getRecentTranscodeJobs(5), [] as any[], 'recent media jobs'),
  ]);

  const profiles = getTranscodeProfiles();
  const fabricSummary = (fabric as any).summary || emptyFabric.summary;
  const receiptKinds = Array.isArray((receipts as any).bySubjectKind) ? (receipts as any).bySubjectKind : [];
  const executionReceiptCount = sumSubjectKinds(receiptKinds, ['EXECUTION', 'DECISION', 'GATE', 'RUN']);
  const approvalEndpointCount = 3;
  const transcodeJobs = Array.isArray(recentJobs) ? recentJobs : [];
  const renditionRungs = profiles.reduce((sum, profile) => sum + (Array.isArray(profile.ladder) ? profile.ladder.length : 0), 0);

  return c.json({
    success: true,
    asOf: now,
    answer: 'Cost, memory, drift, and media workflow signals are accessible now. Approval governance has live APIs and receipts, but needs customer workflow traffic for open-gate and reviewer SLA aggregates.',
    outcomes: {
      'reduce-llm-cost': {
        status: 'live',
        serviceId: 'workflow-memory-fabric',
        summary: 'Cache and savings counters are exposed through observability and memory-fabric analytics.',
        evidence: [
          metric('Cache hit rate', numberValue((stats as any).cache_hit_rate || (stats as any).hit_rate), '%'),
          metric('Hits today', numberValue((stats as any).cache_hits_today)),
          metric('Misses today', numberValue((stats as any).cache_misses_today)),
          metric('Cost saved', numberValue((stats as any).cost_savings_usd), 'USD'),
        ],
        sources: [
          { method: 'GET', path: '/api/observability/stats', fields: ['cache_hit_rate', 'cache_hits_today', 'cost_savings_usd'] },
          { method: 'POST', path: '/api/cache/*', fields: ['semantic cache receipts', 'stable cache keys'] },
        ],
        gaps: [],
      },
      'agent-memory': {
        status: 'live',
        serviceId: 'workflow-memory-fabric',
        summary: 'Memory operations, reads, writes, hits, and estimated savings are available as aggregate fabric analytics.',
        evidence: [
          metric('Memory operations', numberValue(fabricSummary.totalOperations)),
          metric('Reads', numberValue(fabricSummary.reads)),
          metric('Writes', numberValue(fabricSummary.writes)),
          metric('Tokens saved', numberValue(fabricSummary.estimatedTokensSaved)),
        ],
        sources: [
          { method: 'GET', path: '/api/observability/stats', fields: ['fabric.analytics.summary'] },
          { method: 'POST', path: '/api/memory/store', fields: ['structured memory writes'] },
          { method: 'POST', path: '/api/memory/recall', fields: ['policy-aware recall'] },
        ],
        gaps: [],
      },
      'monitor-drift': {
        status: 'live',
        serviceId: 'agent-reliability-mesh',
        summary: 'Execution drift has a summary endpoint and feeds the reliability mesh posture.',
        evidence: [
          metric('Evaluations', numberValue((drift as any).totalEvaluations)),
          metric('Watch', numberValue((drift as any).watchEvaluations)),
          metric('Drifting', numberValue((drift as any).driftingEvaluations)),
          metric('Avg surprise', Number(numberValue((drift as any).averageSurpriseScore).toFixed(3))),
        ],
        sources: [
          { method: 'GET', path: '/api/observability/reliability-mesh', fields: ['summary.driftEvaluations', 'recentDrift'] },
          { method: 'POST', path: '/api/execution/runs/:id/evaluate', fields: ['surpriseScore', 'driftScore', 'verdict'] },
        ],
        gaps: [],
      },
      'govern-approvals': {
        status: executionReceiptCount > 0 ? 'live' : 'partial',
        serviceId: 'decisionrail',
        summary: 'DecisionRail APIs are live; dedicated approval queue analytics become meaningful after governed runs produce traffic.',
        evidence: [
          metric('Shared receipts', numberValue((receipts as any).total || (receipts as any).totalReceipts)),
          metric('Execution receipts', executionReceiptCount),
          metric('Governance endpoints', approvalEndpointCount),
        ],
        sources: [
          { method: 'POST', path: '/api/execution/context-packs', fields: ['reviewerRoles', 'policy', 'workflowPhases'] },
          { method: 'POST', path: '/api/execution/runs', fields: ['gateId', 'requiredReviewerRoles', 'phasePlan'] },
          { method: 'POST', path: '/api/execution/gates/:id/approve', fields: ['approvedBy', 'gateStatus'] },
        ],
        gaps: ['open gate aging', 'reviewer queue depth', 'approval SLA percentiles'],
      },
      'ship-media-workflows': {
        status: 'live',
        serviceId: 'media-workflow-reliability',
        summary: 'Media profiles, planning, queue length, and recent job telemetry are accessible through the transcode API.',
        evidence: [
          metric('Profiles', profiles.length),
          metric('Queued jobs', numberValue(queueLength)),
          metric('Recent jobs', transcodeJobs.length),
          metric('Rendition rungs', renditionRungs),
        ],
        sources: [
          { method: 'GET', path: '/api/transcode/profiles', fields: ['profiles'] },
          { method: 'POST', path: '/api/transcode/plan', fields: ['cache.lookupKey', 'validation.rules', 'output.masterManifestKey'] },
          { method: 'GET', path: '/api/transcode/jobs', fields: ['queueLength', 'jobs'] },
        ],
        gaps: [],
      },
    },
  });
});

advancedServicesRouter.get('/:id', (c) => {
  const service = advancedServicesService.getService(c.req.param('id'));
  if (!service) {
    return c.json({ error: 'Advanced service not found.' }, 404);
  }

  return c.json({ success: true, service });
});

advancedServicesRouter.post('/blueprint', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = blueprintSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const blueprint = advancedServicesService.buildBlueprint(parsed.data as AdvancedServicesBlueprintInput);
    return c.json({ success: true, blueprint }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to build advanced services blueprint.' }, 500);
  }
});

export default advancedServicesRouter;
