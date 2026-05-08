/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

export type AdvancedServiceId =
  | 'workflow-memory-fabric'
  | 'agent-reliability-mesh'
  | 'decisionrail'
  | 'synthetic-ops-sandbox'
  | 'autonomous-compliance-translator'
  | 'swarm-forensics-vault';

export type AdvancedServiceCategory =
  | 'memory'
  | 'reliability'
  | 'governance'
  | 'simulation'
  | 'compliance'
  | 'audit';

export interface AdvancedServiceEndpoint {
  label: string;
  method: 'GET' | 'POST';
  path: string;
  status: 'available' | 'beta';
}

export interface AdvancedServiceDefinition {
  id: AdvancedServiceId;
  rank: number;
  name: string;
  category: AdvancedServiceCategory;
  buyer: string;
  outcome: string;
  wedge: string;
  maturity: 'available' | 'beta';
  pricingUnit: string;
  implementationTime: string;
  capabilities: string[];
  controls: string[];
  endpoints: AdvancedServiceEndpoint[];
}

export interface AdvancedServicesBlueprintInput {
  objective: string;
  sector?: string | null;
  autonomy?: 'shadow' | 'copilot' | 'autonomous' | null;
  riskTolerance?: 'low' | 'medium' | 'high' | null;
  systems?: string[] | null;
  painPoints?: string[] | null;
  currentStack?: string[] | null;
  regulated?: boolean | null;
}

export interface AdvancedServicesBlueprintRecommendation {
  service: AdvancedServiceDefinition;
  priority: 1 | 2 | 3 | 4 | 5 | 6;
  fitScore: number;
  reason: string;
  firstMilestone: string;
}

export interface AdvancedServicesBlueprint {
  blueprintId: string;
  createdAt: string;
  objective: string;
  sector: string;
  autonomy: 'shadow' | 'copilot' | 'autonomous';
  riskTolerance: 'low' | 'medium' | 'high';
  regulated: boolean;
  summary: string;
  recommendedBundle: AdvancedServicesBlueprintRecommendation[];
  architecture: Array<{
    layer: string;
    owner: string;
    serviceIds: AdvancedServiceId[];
    responsibility: string;
  }>;
  implementationPlan: Array<{
    phase: string;
    duration: string;
    goal: string;
    deliverables: string[];
    exitCriteria: string[];
  }>;
  policyPack: Array<{
    control: string;
    mode: 'monitor' | 'review' | 'block';
    rationale: string;
  }>;
  starterRequests: Array<{
    name: string;
    method: 'GET' | 'POST';
    path: string;
    body?: Record<string, unknown>;
  }>;
  commercial: {
    packaging: string;
    pricingMeter: string;
    buyerProof: string;
  };
}

const SERVICE_CATALOG: AdvancedServiceDefinition[] = [
  {
    id: 'agent-reliability-mesh',
    rank: 1,
    name: 'Agent Reliability Mesh',
    category: 'reliability',
    buyer: 'Enterprises running multiple agents in production',
    outcome: 'Trust scores, drift detection, intervention posture, and replayable accountability for agent work.',
    wedge: 'Start with observability and receipts, then expand into policy gates and workflow kill switches.',
    maturity: 'available',
    pricingUnit: 'per 10k monitored agent actions plus operator seats',
    implementationTime: '2-4 weeks',
    capabilities: [
      'policy enforcement telemetry',
      'execution drift scoring',
      'shared receipts',
      'kill-switch posture',
      'multi-agent trace map',
    ],
    controls: [
      'block elevated drift',
      'route low-confidence actions to review',
      'export receipts for audit',
    ],
    endpoints: [
      { label: 'Reliability posture', method: 'GET', path: '/api/observability/reliability-mesh', status: 'available' },
      { label: 'Observability stats', method: 'GET', path: '/api/observability/stats', status: 'available' },
      { label: 'Execution evaluations', method: 'POST', path: '/api/execution/runs/:id/evaluate', status: 'available' },
    ],
  },
  {
    id: 'workflow-memory-fabric',
    rank: 2,
    name: 'Workflow Memory Fabric',
    category: 'memory',
    buyer: 'AI-native SaaS teams, operations teams, and regulated workspaces',
    outcome: 'Durable shared context across tasks, tools, agents, and human approvals.',
    wedge: 'Use memory structure, policy-aware cache keys, and receipts to turn context into a governed substrate.',
    maturity: 'available',
    pricingUnit: 'storage, retrieval volume, and premium orchestration credits',
    implementationTime: '1-3 weeks',
    capabilities: [
      'task-state memory',
      'decision and constraint recall',
      'workspace namespaces',
      'lineage-aware context',
      'sector policy profiles',
    ],
    controls: [
      'namespace isolation',
      'regulated retention profiles',
      'memory write-back review',
    ],
    endpoints: [
      { label: 'Store memory', method: 'POST', path: '/api/memory/store', status: 'available' },
      { label: 'Recall memory', method: 'POST', path: '/api/memory/recall', status: 'available' },
      { label: 'Fabric policy profile', method: 'POST', path: '/api/cache/fabric/profile', status: 'available' },
    ],
  },
  {
    id: 'decisionrail',
    rank: 3,
    name: 'DecisionRail',
    category: 'governance',
    buyer: 'Finance, procurement, RevOps, logistics, legal operations, and regulated execution teams',
    outcome: 'Model recommendations become bounded decisions with confidence checks, budgets, approvals, and receipts.',
    wedge: 'Package execution control around context packs, reviewer roles, workflow phases, and approval gates.',
    maturity: 'available',
    pricingUnit: 'per governed workflow lane or decision volume',
    implementationTime: '2-5 weeks',
    capabilities: [
      'context packs',
      'workflow state machine',
      'reviewer roles',
      'human approval gates',
      'reversible run logs',
    ],
    controls: [
      'require approval for final actions',
      'block missing reviewer roles',
      'record every decision receipt',
    ],
    endpoints: [
      { label: 'Create context pack', method: 'POST', path: '/api/execution/context-packs', status: 'available' },
      { label: 'Start governed run', method: 'POST', path: '/api/execution/runs', status: 'available' },
      { label: 'Approve gate', method: 'POST', path: '/api/execution/gates/:id/approve', status: 'available' },
    ],
  },
  {
    id: 'synthetic-ops-sandbox',
    rank: 4,
    name: 'Synthetic Ops Sandbox',
    category: 'simulation',
    buyer: 'Transformation teams stress-testing agent workflows before rollout',
    outcome: 'Shadow-mode workflow rehearsals that surface failure modes before production exposure.',
    wedge: 'Reuse runtime plans, execution drift checks, and pathological assessments as repeatable launch rehearsals.',
    maturity: 'beta',
    pricingUnit: 'per simulated scenario pack',
    implementationTime: '3-6 weeks',
    capabilities: [
      'shadow execution',
      'failure-mode rehearsal',
      'scenario scorecards',
      'launch readiness checks',
    ],
    controls: [
      'never execute external actions in shadow',
      'escalate low confidence scenarios',
      'compare expected and actual phases',
    ],
    endpoints: [
      { label: 'Runtime plan', method: 'POST', path: '/api/runtime/plan', status: 'available' },
      { label: 'Drift evaluation', method: 'POST', path: '/api/execution/runs/:id/evaluate', status: 'available' },
    ],
  },
  {
    id: 'autonomous-compliance-translator',
    rank: 5,
    name: 'Autonomous Compliance Translator',
    category: 'compliance',
    buyer: 'Legal, procurement, and enterprise AI governance teams',
    outcome: 'Policy language becomes runtime controls, reviewer roles, and audit-ready receipts.',
    wedge: 'Translate controls into Memory Fabric profiles and DecisionRail gates.',
    maturity: 'beta',
    pricingUnit: 'per domain policy pack',
    implementationTime: '4-8 weeks',
    capabilities: [
      'policy-to-control mapping',
      'sector-specific retention',
      'approval role generation',
      'compliance receipt exports',
    ],
    controls: [
      'map policy clauses to workflow gates',
      'retain regulated receipts',
      'block unsupported action types',
    ],
    endpoints: [
      { label: 'Fabric policy profile', method: 'POST', path: '/api/cache/fabric/profile', status: 'available' },
      { label: 'Create context pack', method: 'POST', path: '/api/execution/context-packs', status: 'available' },
    ],
  },
  {
    id: 'swarm-forensics-vault',
    rank: 6,
    name: 'Swarm Forensics Vault',
    category: 'audit',
    buyer: 'Regulated enterprises, insurers, auditors, and AI platform teams',
    outcome: 'Replayable provenance for agent failures, approvals, tool calls, and policy decisions.',
    wedge: 'Store receipts, traces, drift reports, and graph relationships under one audit export.',
    maturity: 'beta',
    pricingUnit: 'retention tier plus audit export volume',
    implementationTime: '3-7 weeks',
    capabilities: [
      'immutable receipt index',
      'failure corpus',
      'operator graph export',
      'incident reconstruction',
    ],
    controls: [
      'retain signed receipts',
      'preserve action lineage',
      'redact sensitive evidence on export',
    ],
    endpoints: [
      { label: 'Receipt summary', method: 'GET', path: '/api/observability/stats', status: 'available' },
      { label: 'Run bundle', method: 'GET', path: '/api/execution/runs/:id', status: 'available' },
    ],
  },
];

const SERVICE_MAP = new Map(SERVICE_CATALOG.map((service) => [service.id, service]));

function normalizeList(value?: string[] | null): string[] {
  return (value || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeText(value: unknown, fallback = ''): string {
  return String(value || fallback).trim();
}

function normalizeSector(value?: string | null): string {
  const sector = normalizeText(value, 'general').toLowerCase();
  return sector || 'general';
}

function normalizeAutonomy(value?: AdvancedServicesBlueprintInput['autonomy']): 'shadow' | 'copilot' | 'autonomous' {
  if (value === 'autonomous' || value === 'copilot' || value === 'shadow') return value;
  return 'copilot';
}

function normalizeRisk(value?: AdvancedServicesBlueprintInput['riskTolerance']): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function hasAny(haystack: string, terms: string[]) {
  return terms.some((term) => haystack.includes(term));
}

function scoreService(service: AdvancedServiceDefinition, input: {
  objective: string;
  sector: string;
  autonomy: 'shadow' | 'copilot' | 'autonomous';
  riskTolerance: 'low' | 'medium' | 'high';
  systems: string[];
  painPoints: string[];
  regulated: boolean;
}) {
  const corpus = [
    input.objective,
    input.sector,
    input.autonomy,
    input.riskTolerance,
    ...input.systems,
    ...input.painPoints,
  ].join(' ').toLowerCase();

  let score = 76 - service.rank * 2;

  if (service.id === 'workflow-memory-fabric') {
    if (hasAny(corpus, ['memory', 'context', 'handoff', 'knowledge', 'rag', 'workspace', 'state'])) score += 18;
    if (input.systems.length > 1) score += 6;
  }

  if (service.id === 'agent-reliability-mesh') {
    if (hasAny(corpus, ['reliability', 'trust', 'observability', 'trace', 'monitor', 'drift', 'rollback'])) score += 18;
    if (input.autonomy !== 'shadow') score += 8;
  }

  if (service.id === 'decisionrail') {
    if (hasAny(corpus, ['approval', 'decision', 'budget', 'procurement', 'pay', 'publish', 'send', 'execute', 'gate'])) score += 20;
    if (input.riskTolerance === 'low' || input.regulated) score += 8;
  }

  if (service.id === 'synthetic-ops-sandbox') {
    if (hasAny(corpus, ['simulate', 'sandbox', 'test', 'failure', 'launch', 'rollout', 'pilot'])) score += 18;
    if (input.autonomy === 'shadow') score += 7;
  }

  if (service.id === 'autonomous-compliance-translator') {
    if (hasAny(corpus, ['compliance', 'policy', 'legal', 'hipaa', 'sox', 'gdpr', 'procurement'])) score += 19;
    if (input.regulated || ['finance', 'legal', 'healthcare', 'energy', 'biotech'].includes(input.sector)) score += 9;
  }

  if (service.id === 'swarm-forensics-vault') {
    if (hasAny(corpus, ['audit', 'incident', 'forensics', 'replay', 'evidence', 'provenance', 'insurance'])) score += 18;
    if (input.regulated) score += 7;
  }

  return Math.max(1, Math.min(100, score));
}

function reasonFor(service: AdvancedServiceDefinition, input: {
  autonomy: 'shadow' | 'copilot' | 'autonomous';
  riskTolerance: 'low' | 'medium' | 'high';
  regulated: boolean;
}) {
  if (service.id === 'workflow-memory-fabric') {
    return 'Provides durable task context, permissions, lineage, and recall before agents make or explain decisions.';
  }
  if (service.id === 'agent-reliability-mesh') {
    return `Monitors ${input.autonomy} agent activity with drift, receipt, policy, and intervention signals.`;
  }
  if (service.id === 'decisionrail') {
    return input.regulated || input.riskTolerance === 'low'
      ? 'Turns recommendations into gated decisions with reviewer roles, approval checkpoints, and audit receipts.'
      : 'Adds a bounded execution lane so actions remain reviewable and reversible.';
  }
  if (service.id === 'synthetic-ops-sandbox') {
    return 'Runs workflow rehearsals in shadow mode before production exposure.';
  }
  if (service.id === 'autonomous-compliance-translator') {
    return 'Converts governance requirements into runtime controls, retention posture, and approval roles.';
  }
  return 'Preserves traces, receipts, and failure evidence for incident review and audit exports.';
}

function firstMilestoneFor(service: AdvancedServiceDefinition) {
  if (service.id === 'workflow-memory-fabric') return 'Ship namespace policy, structured memory writes, and top-k recall in the first workspace.';
  if (service.id === 'agent-reliability-mesh') return 'Expose reliability posture, drift watch, and receipt coverage for one production workflow.';
  if (service.id === 'decisionrail') return 'Create one context pack, reviewer role set, and approval gate for a real final action.';
  if (service.id === 'synthetic-ops-sandbox') return 'Run five shadow scenarios and compare expected versus actual workflow phases.';
  if (service.id === 'autonomous-compliance-translator') return 'Map one policy pack into runtime gates and retention controls.';
  return 'Export receipt-backed evidence for one completed or failed workflow run.';
}

function buildImplementationPlan(input: {
  sector: string;
  autonomy: 'shadow' | 'copilot' | 'autonomous';
  regulated: boolean;
}): AdvancedServicesBlueprint['implementationPlan'] {
  return [
    {
      phase: 'Foundation',
      duration: 'Days 0-7',
      goal: 'Make the first workflow observable and context-aware.',
      deliverables: [
        'Select one production workflow and define success, failure, and review states.',
        'Attach Memory Fabric namespaces and structured memory fields.',
        'Enable Reliability Mesh posture and receipt coverage.',
      ],
      exitCriteria: [
        'One workflow produces receipts and reliability posture.',
        'Memory recall returns relevant context with namespace isolation.',
      ],
    },
    {
      phase: 'Control',
      duration: 'Days 8-21',
      goal: 'Turn risky actions into bounded decisions.',
      deliverables: [
        'Create a DecisionRail context pack with reviewer roles.',
        'Add gates for publish, send, pay, delete, or external store actions.',
        `Apply ${input.sector} policy profile and retention defaults.`,
      ],
      exitCriteria: [
        'A governed run can move through draft, review, gate, and finalize.',
        'Blocked and approved runs are distinguishable in receipts.',
      ],
    },
    {
      phase: 'Hardening',
      duration: 'Days 22-45',
      goal: 'Find failure modes before expansion.',
      deliverables: [
        'Run shadow scenarios in the Synthetic Ops Sandbox.',
        'Evaluate execution drift after representative runs.',
        'Create intervention thresholds for reliability score and collapse risk.',
      ],
      exitCriteria: [
        'Reliability score remains above 85 on target workflows.',
        'Drift evaluations have clear owner actions.',
      ],
    },
    {
      phase: 'Expansion',
      duration: 'Days 46-90',
      goal: input.autonomy === 'autonomous'
        ? 'Scale controlled autonomy across additional workflows.'
        : 'Scale copilot execution with audit-ready controls.',
      deliverables: [
        'Package the workflow as a reusable service lane.',
        'Add compliance exports and forensics retention where required.',
        'Meter usage by monitored action, memory operation, and governed decision.',
      ],
      exitCriteria: [
        'Service lane has clear pricing and SLA posture.',
        input.regulated ? 'Compliance export is ready for customer review.' : 'Operator dashboard is ready for customer review.',
      ],
    },
  ];
}

function buildPolicyPack(input: {
  autonomy: 'shadow' | 'copilot' | 'autonomous';
  riskTolerance: 'low' | 'medium' | 'high';
  regulated: boolean;
}): AdvancedServicesBlueprint['policyPack'] {
  const pack: AdvancedServicesBlueprint['policyPack'] = [
    {
      control: 'Prompt injection and unsafe input validation',
      mode: 'block',
      rationale: 'No service lane should execute on compromised inputs.',
    },
    {
      control: 'Memory namespace isolation',
      mode: 'block',
      rationale: 'Shared context is valuable only if tenants, sectors, and workspaces remain separated.',
    },
    {
      control: 'Execution drift evaluation',
      mode: input.autonomy === 'shadow' ? 'monitor' : 'review',
      rationale: 'Unexpected phase movement or high surprise should stop uncontrolled expansion.',
    },
    {
      control: 'Human approval for final actions',
      mode: input.autonomy === 'autonomous' || input.riskTolerance === 'low' || input.regulated ? 'review' : 'monitor',
      rationale: 'External or irreversible actions need explicit accountability.',
    },
  ];

  if (input.regulated) {
    pack.push({
      control: 'Receipt retention and audit export',
      mode: 'review',
      rationale: 'Regulated buyers need evidence that decisions were bounded by policy.',
    });
  }

  return pack;
}

function stableBlueprintId(input: AdvancedServicesBlueprintInput) {
  const text = JSON.stringify({
    objective: input.objective,
    sector: input.sector || 'general',
    autonomy: input.autonomy || 'copilot',
    systems: normalizeList(input.systems),
    painPoints: normalizeList(input.painPoints),
  });

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }

  return `svc_${Math.abs(hash).toString(36).padStart(6, '0')}`;
}

export class AdvancedServicesService {
  getCatalog() {
    return SERVICE_CATALOG;
  }

  getService(id: string) {
    return SERVICE_MAP.get(id as AdvancedServiceId) || null;
  }

  buildBlueprint(rawInput: AdvancedServicesBlueprintInput): AdvancedServicesBlueprint {
    const objective = normalizeText(rawInput.objective, 'Deploy a reliable agent workflow.');
    const sector = normalizeSector(rawInput.sector);
    const autonomy = normalizeAutonomy(rawInput.autonomy);
    const riskTolerance = normalizeRisk(rawInput.riskTolerance);
    const systems = normalizeList(rawInput.systems);
    const painPoints = normalizeList(rawInput.painPoints);
    const regulated = Boolean(rawInput.regulated || ['finance', 'legal', 'healthcare', 'energy', 'biotech'].includes(sector));

    const scored = SERVICE_CATALOG
      .map((service) => ({
        service,
        fitScore: scoreService(service, {
          objective,
          sector,
          autonomy,
          riskTolerance,
          systems,
          painPoints,
          regulated,
        }),
      }))
      .sort((a, b) => b.fitScore - a.fitScore || a.service.rank - b.service.rank);

    const requiredStack: AdvancedServiceId[] = [
      'workflow-memory-fabric',
      'agent-reliability-mesh',
      'decisionrail',
    ];
    const byId = new Map(scored.map((item) => [item.service.id, item]));
    const selectedIds = Array.from(new Set([
      ...requiredStack,
      ...scored.slice(0, 4).map((item) => item.service.id),
    ])).slice(0, 5);

    const recommendedBundle = selectedIds
      .map((id, index) => {
        const item = byId.get(id)!;
        return {
          service: item.service,
          priority: (index + 1) as AdvancedServicesBlueprintRecommendation['priority'],
          fitScore: item.fitScore,
          reason: reasonFor(item.service, { autonomy, riskTolerance, regulated }),
          firstMilestone: firstMilestoneFor(item.service),
        };
      })
      .sort((a, b) => {
        const aRequired = requiredStack.indexOf(a.service.id);
        const bRequired = requiredStack.indexOf(b.service.id);
        if (aRequired !== -1 || bRequired !== -1) {
          return (aRequired === -1 ? 99 : aRequired) - (bRequired === -1 ? 99 : bRequired);
        }
        return b.fitScore - a.fitScore;
      })
      .map((item, index) => ({ ...item, priority: (index + 1) as AdvancedServicesBlueprintRecommendation['priority'] }));

    return {
      blueprintId: stableBlueprintId(rawInput),
      createdAt: new Date().toISOString(),
      objective,
      sector,
      autonomy,
      riskTolerance,
      regulated,
      summary: `Build a ${sector} service lane with durable memory, reliability posture, and governed decisions before scaling ${autonomy} execution.`,
      recommendedBundle,
      architecture: [
        {
          layer: 'Substrate',
          owner: 'Workflow Memory Fabric',
          serviceIds: ['workflow-memory-fabric'],
          responsibility: 'Persist tasks, constraints, decisions, prior actions, and tool outcomes with namespace and policy boundaries.',
        },
        {
          layer: 'Control Plane',
          owner: 'Agent Reliability Mesh',
          serviceIds: ['agent-reliability-mesh', 'swarm-forensics-vault'],
          responsibility: 'Score reliability, drift, trace coverage, receipt health, and intervention readiness.',
        },
        {
          layer: 'Execution Lane',
          owner: 'DecisionRail',
          serviceIds: ['decisionrail', 'autonomous-compliance-translator'],
          responsibility: 'Convert model output into reviewable actions with gates, budgets, reviewer roles, and receipts.',
        },
        {
          layer: 'Launch Safety',
          owner: 'Synthetic Ops Sandbox',
          serviceIds: ['synthetic-ops-sandbox'],
          responsibility: 'Run shadow rehearsals and failure-mode tests before adding more systems or autonomy.',
        },
      ],
      implementationPlan: buildImplementationPlan({ sector, autonomy, regulated }),
      policyPack: buildPolicyPack({ autonomy, riskTolerance, regulated }),
      starterRequests: [
        {
          name: 'Plan a cognitive runtime pass',
          method: 'POST',
          path: '/api/runtime/plan',
          body: {
            input: objective,
            objective,
            mode: 'plan',
            sectorHint: sector,
            privacyMode: regulated ? 'redacted' : 'standard',
            memory: {
              topK: 5,
              namespace: systems[0] || 'primary-workspace',
            },
            requireHumanGate: riskTolerance === 'low' || regulated,
          },
        },
        {
          name: 'Create a DecisionRail context pack',
          method: 'POST',
          path: '/api/execution/context-packs',
          body: {
            name: `${sector.charAt(0).toUpperCase()}${sector.slice(1)} Governed Workflow`,
            objective,
            sectorHint: sector,
            workflowTemplate: regulated ? 'regulated_release' : 'generic',
            workflowPhases: ['draft', 'review', 'gate', 'finalize'],
            reviewerRoles: regulated ? ['critical', 'compliance'] : ['operator'],
            policyProfile: { verticalSku: sector === 'finance' ? 'finance-memory-fabric' : 'enterprise-copilot' },
          },
        },
        {
          name: 'Read Reliability Mesh posture',
          method: 'GET',
          path: '/api/observability/reliability-mesh',
        },
      ],
      commercial: {
        packaging: 'Platform fee plus service-lane add-ons for reliability, memory, and governed decisions.',
        pricingMeter: 'Monitored actions, memory operations, governed decisions, and audit retention.',
        buyerProof: 'Show before/after latency, cache savings, reliability score, blocked-risk count, and approval-cycle time.',
      },
    };
  }
}

export const advancedServicesService = new AdvancedServicesService();
