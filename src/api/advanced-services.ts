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

const OUTCOME_GUIDES = {
  'reduce-llm-cost': {
    what: 'A cache-and-reuse lane for LLM prompts, tool results, and safe memory so repeated work does not keep spending tokens.',
    useFor: [
      'support answers, research loops, classification, summarization, and repeated tool outputs',
      'workloads where equivalent requests arrive often enough to reuse safely',
    ],
    whenToUse: [
      'LLM spend is growing faster than usage',
      'teams need cache hit proof, freshness rules, and model-agnostic reuse',
    ],
    why: 'It lowers unit cost while keeping a visible trail for hits, misses, freshness, and savings.',
    howToStart: 'Send representative prompts through the cache API, then watch hit rate and savings through observability stats.',
    firstRequest: { method: 'GET', path: '/api/observability/stats' },
    expectedProof: ['cache_hit_rate', 'cache_hits_today', 'cache_misses_today', 'cost_savings_usd'],
    agentContract: {
      chooseWhen: 'The objective mentions LLM cost, duplicate prompts, tool result reuse, freshness, or cache trust.',
      requiredInputs: ['objective', 'provider/model or tool family', 'freshness policy', 'risk tolerance'],
      output: 'A cache policy, starter requests, and metrics that prove whether reuse is working.',
    },
  },
  'agent-memory': {
    what: 'A durable context lane that lets agents store, recall, and inspect task state, decisions, constraints, and tool outcomes.',
    useFor: [
      'cross-session context, workspace memory, decision recall, agent handoffs, and audit-friendly memory writes',
      'teams that need context reuse without mixing tenants, sectors, or workspaces',
    ],
    whenToUse: [
      'agents repeat discovery or lose handoff context',
      'operators need to know which stored facts influenced an answer',
    ],
    why: 'It makes agent work continuous, inspectable, and bounded by namespace and policy controls.',
    howToStart: 'Create a memory namespace, store a small set of decisions or constraints, then test recall against real workflow prompts.',
    firstRequest: { method: 'POST', path: '/api/memory/store' },
    expectedProof: ['fabric.analytics.summary.totalOperations', 'reads', 'writes', 'estimatedTokensSaved'],
    agentContract: {
      chooseWhen: 'The objective mentions memory, context, recall, handoffs, workspace state, or decision history.',
      requiredInputs: ['objective', 'namespace', 'sector', 'systems', 'retention or isolation rules'],
      output: 'A memory policy, starter store/recall requests, and analytics showing memory operations.',
    },
  },
  'monitor-drift': {
    what: 'A reliability lane that watches agent runs for unexpected phase movement, surprise, policy pressure, and intervention risk.',
    useFor: [
      'production agent monitoring, shadow evaluations, reliability posture, and escalation thresholds',
      'teams that need to spot drift before customers or operators feel it',
    ],
    whenToUse: [
      'agents make multi-step decisions or touch external systems',
      'operators cannot tell when behavior is changing from the intended workflow',
    ],
    why: 'It turns vague trust concerns into measurable drift, receipt, and posture signals.',
    howToStart: 'Run one governed workflow, evaluate the run, then inspect reliability posture and recent drift.',
    firstRequest: { method: 'GET', path: '/api/observability/reliability-mesh' },
    expectedProof: ['reliabilityScore', 'summary.driftEvaluations', 'recentDrift', 'killSwitch.status'],
    agentContract: {
      chooseWhen: 'The objective mentions reliability, drift, monitoring, trust, intervention, or production agent safety.',
      requiredInputs: ['objective', 'workflow phases', 'expected behavior', 'risk tolerance', 'operator owner'],
      output: 'A drift watch plan, reliability posture, and evidence fields for intervention decisions.',
    },
  },
  'govern-approvals': {
    what: 'A governed execution lane that turns recommendations into reviewable decisions with roles, gates, approvals, and receipts.',
    useFor: [
      'finance, procurement, RevOps, legal operations, publishing, payments, and irreversible external actions',
      'workflows where agents can prepare decisions but humans or policies must approve final action',
    ],
    whenToUse: [
      'a wrong action has financial, legal, customer, or compliance impact',
      'reviewers need context and audit evidence before approving',
    ],
    why: 'It separates recommendation from execution so useful autonomy does not erase accountability.',
    howToStart: 'Create a context pack, start one governed run, then require a gate approval before final action.',
    firstRequest: { method: 'POST', path: '/api/execution/context-packs' },
    expectedProof: ['gateId', 'requiredReviewerRoles', 'gateStatus', 'shared receipts'],
    agentContract: {
      chooseWhen: 'The objective mentions approvals, gates, budgets, reviewer roles, final actions, or audit requirements.',
      requiredInputs: ['objective', 'reviewer roles', 'approval policy', 'systems touched', 'risk tolerance'],
      output: 'A context pack, governed run, approval gate, and receipt trail.',
    },
  },
  'ship-media-workflows': {
    what: 'A media reliability lane for planning, queueing, validating, caching, and publishing HLS or streaming-ready outputs.',
    useFor: [
      'video ingest, FFmpeg transcode planning, HLS renditions, CDN handoff, Roku/web playback readiness',
      'media teams that need proof before publishing or reusing encoded assets',
    ],
    whenToUse: [
      'encoding jobs are opaque or fail late',
      'duplicate renditions waste compute and playback readiness is hard to prove',
    ],
    why: 'It makes media workflows inspectable before publish: source fingerprint, profile, queue status, manifests, validation, and cache reuse.',
    howToStart: 'Select a profile, plan one source asset, submit the job, then watch jobs and validation outputs.',
    firstRequest: { method: 'POST', path: '/api/transcode/plan' },
    expectedProof: ['profiles', 'queueLength', 'cache.lookupKey', 'output.masterManifestKey', 'validation.rules'],
    agentContract: {
      chooseWhen: 'The objective mentions media, video, FFmpeg, HLS, Roku, CDN, transcoding, manifests, or playback readiness.',
      requiredInputs: ['inputKey', 'profile', 'outputPrefix or bucket policy', 'publishing target'],
      output: 'A media plan, transcode job, validation rules, queue visibility, and playback-ready output keys.',
    },
  },
} as const;

function withGuide<T extends Record<string, unknown>>(id: keyof typeof OUTCOME_GUIDES, payload: T) {
  return {
    ...payload,
    guide: OUTCOME_GUIDES[id],
  };
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
      'reduce-llm-cost': withGuide('reduce-llm-cost', {
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
      }),
      'agent-memory': withGuide('agent-memory', {
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
      }),
      'monitor-drift': withGuide('monitor-drift', {
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
      }),
      'govern-approvals': withGuide('govern-approvals', {
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
      }),
      'ship-media-workflows': withGuide('ship-media-workflows', {
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
      }),
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
