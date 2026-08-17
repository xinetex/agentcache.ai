/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */
import { getTier, type Tier } from './tiers.js';

export type AgenticPlanId = 'free' | 'pro' | 'enterprise';

export type AgenticRevenueMotion =
  | 'subscription'
  | 'add_on'
  | 'usage_meter'
  | 'design_partner_pilot';

type LimitValue = number | 'unlimited';

export type AgenticCommercialTier = {
  id: AgenticPlanId;
  name: string;
  priceMonthlyUsd: number | null;
  quotaRequestsMonthly: number;
  buyer: string;
  productionUse: string;
  includedProducts: string[];
  availableAddons: string[];
  limits: {
    agentSlots: LimitValue;
    namespaces: LimitValue;
    pipelineNodes: LimitValue;
    ttlDays: LimitValue;
  };
  checkoutUrl: string;
  upgrade: AgenticUpgradePath | null;
};

export type AgenticAddon = {
  id: string;
  productId: string;
  name: string;
  description: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  availableFromPlan: AgenticPlanId;
  includedInPlans: AgenticPlanId[];
  checkoutEndpoint: string;
  checkoutBody: Record<string, string>;
};

export type AgenticMeteredSku = {
  id: string;
  productId: string;
  name: string;
  unit: string;
  billingMode: 'included_quota' | 'credit_estimate' | 'usage_meter' | 'pilot_meter';
  pricing: string;
  minimumPlan: AgenticPlanId;
  sourceOfTruth: string;
};

export type AgenticPilot = {
  id: string;
  productId: string;
  name: string;
  priceMonthlyUsd: number;
  includedVolume: string;
  term: string;
  contactUrl: string;
};

export type AgenticUpgradePath = {
  targetPlan: AgenticPlanId;
  url: string;
  reason: string;
};

export type ProductCommercialModel = {
  productId: string;
  revenueMotions: AgenticRevenueMotion[];
  minimumPlan: AgenticPlanId;
  checkoutUrl: string;
  billingNote: string;
  addonIds: string[];
  meterSkuIds: string[];
  pilotIds: string[];
};

const PLAN_ORDER: AgenticPlanId[] = ['free', 'pro', 'enterprise'];

const PLAN_POSITION: Record<AgenticPlanId, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

const PLAN_COPY: Record<AgenticPlanId, Pick<AgenticCommercialTier, 'buyer' | 'productionUse' | 'includedProducts' | 'availableAddons' | 'checkoutUrl'>> = {
  free: {
    buyer: 'Solo builders and evaluating agents.',
    productionUse: 'Discovery, prototyping, and low-volume agent memory/cache tests.',
    includedProducts: ['agentcache-core'],
    availableAddons: [],
    checkoutUrl: '/signup.html',
  },
  pro: {
    buyer: 'Teams running production assistants, copilots, and workflow agents.',
    productionUse: 'Private namespaces, semantic reuse, drift monitoring, and higher request volume.',
    includedProducts: ['agentcache-core', 'execution-drift-guard'],
    availableAddons: ['guardrails', 'knowledge'],
    checkoutUrl: '/upgrade.html?plan=pro',
  },
  enterprise: {
    buyer: 'Organizations operating regulated, high-volume, or storage-heavy agent fleets.',
    productionUse: 'Custom governance, unlimited agent slots, included safety/knowledge lanes, and design-partner storage/media packages.',
    includedProducts: [
      'agentcache-core',
      'execution-drift-guard',
      'agentcache-guardrails',
      'agentcache-knowledge',
      'agent-storage-core',
    ],
    availableAddons: [],
    checkoutUrl: '/contact.html?interest=enterprise',
  },
};

export const AGENTIC_ADDONS: AgenticAddon[] = [
  {
    id: 'guardrails',
    productId: 'agentcache-guardrails',
    name: 'Guardrails',
    description: 'Prompt injection, secret leakage, and policy enforcement for agent input before execution.',
    priceMonthlyUsd: 99,
    priceYearlyUsd: 990,
    availableFromPlan: 'pro',
    includedInPlans: ['enterprise'],
    checkoutEndpoint: 'POST /api/billing/create-checkout',
    checkoutBody: { addonId: 'guardrails', billingPeriod: 'monthly' },
  },
  {
    id: 'knowledge',
    productId: 'agentcache-knowledge',
    name: 'Knowledge',
    description: 'Document ingest, semantic search, and retrieval-ready workspace memory.',
    priceMonthlyUsd: 99,
    priceYearlyUsd: 990,
    availableFromPlan: 'pro',
    includedInPlans: ['enterprise'],
    checkoutEndpoint: 'POST /api/billing/create-checkout',
    checkoutBody: { addonId: 'knowledge', billingPeriod: 'monthly' },
  },
];

export const AGENTIC_METERED_SKUS: AgenticMeteredSku[] = [
  {
    id: 'cache-request',
    productId: 'agentcache-core',
    name: 'Cache request',
    unit: 'request',
    billingMode: 'included_quota',
    pricing: 'Included in plan request quota.',
    minimumPlan: 'free',
    sourceOfTruth: 'src/config/tiers.ts',
  },
  {
    id: 'memory-fabric-credit',
    productId: 'agentcache-core',
    name: 'Memory fabric credit',
    unit: 'credit',
    billingMode: 'credit_estimate',
    pricing: 'Estimated at 100 credits per USD for SKU-aware fabric accounting.',
    minimumPlan: 'pro',
    sourceOfTruth: 'src/services/MemoryFabricBillingService.ts',
  },
  {
    id: 'browser-proof',
    productId: 'agentcache-guardrails',
    name: 'Browser proof',
    unit: 'proof',
    billingMode: 'credit_estimate',
    pricing: 'Estimated by evidence mode; clinical proof costs more than audit proof.',
    minimumPlan: 'pro',
    sourceOfTruth: 'src/services/MemoryFabricBillingService.ts',
  },
  {
    id: 'evidence-claim',
    productId: 'agentcache-knowledge',
    name: 'Evidence claim',
    unit: 'claim',
    billingMode: 'credit_estimate',
    pricing: 'Estimated by source-bound claim count and review status.',
    minimumPlan: 'pro',
    sourceOfTruth: 'src/services/EvidencePackService.ts',
  },
  {
    id: 'hardening-assessment',
    productId: 'execution-drift-guard',
    name: 'Hardening assessment',
    unit: 'assessment',
    billingMode: 'pilot_meter',
    pricing: 'Bundled in Drift Guard pilots, then metered by evaluated run volume.',
    minimumPlan: 'pro',
    sourceOfTruth: 'src/api/pathological.ts',
  },
  {
    id: 'storage-gb-month',
    productId: 'agent-storage-core',
    name: 'Agent artifact storage',
    unit: 'GB-month',
    billingMode: 'usage_meter',
    pricing: '$0.023 per GB-month baseline storage.',
    minimumPlan: 'enterprise',
    sourceOfTruth: 'src/api/catalog.ts',
  },
  {
    id: 'storage-egress-gb',
    productId: 'agent-storage-core',
    name: 'Agent artifact egress',
    unit: 'GB egress',
    billingMode: 'usage_meter',
    pricing: '$0.05 per GB egress baseline.',
    minimumPlan: 'enterprise',
    sourceOfTruth: 'src/api/catalog.ts',
  },
  {
    id: 'transcode-minute',
    productId: 'agent-storage-core',
    name: 'Media transcode minute',
    unit: 'source minute',
    billingMode: 'usage_meter',
    pricing: '$0.015 per source minute baseline.',
    minimumPlan: 'enterprise',
    sourceOfTruth: 'src/api/catalog.ts',
  },
];

export const AGENTIC_DESIGN_PARTNER_PILOTS: AgenticPilot[] = [
  {
    id: 'execution-drift-guard-pilot',
    productId: 'execution-drift-guard',
    name: 'Execution Drift Guard pilot',
    priceMonthlyUsd: 1500,
    includedVolume: 'Up to 50K evaluated runs per month.',
    term: '90-day paid pilot.',
    contactUrl: '/contact.html?interest=execution-drift-guard',
  },
  {
    id: 'agent-storage-core-pilot',
    productId: 'agent-storage-core',
    name: 'Agent Storage Core pilot',
    priceMonthlyUsd: 2500,
    includedVolume: 'Artifact orchestration, namespace isolation, and storage/egress usage metered separately.',
    term: 'Design-partner pilot.',
    contactUrl: '/contact.html?interest=agent-storage-core',
  },
];

const PRODUCT_COMMERCIAL_MODELS: Record<string, Omit<ProductCommercialModel, 'productId'>> = {
  'agentcache-core': {
    revenueMotions: ['subscription', 'usage_meter'],
    minimumPlan: 'free',
    checkoutUrl: '/signup.html',
    billingNote: 'Base subscription controls quota, agent slots, namespaces, and cache capability.',
    addonIds: [],
    meterSkuIds: ['cache-request', 'memory-fabric-credit'],
    pilotIds: [],
  },
  'agentcache-guardrails': {
    revenueMotions: ['add_on', 'usage_meter'],
    minimumPlan: 'pro',
    checkoutUrl: '/addons.html?addon=guardrails',
    billingNote: 'Available as a Pro add-on and bundled into Enterprise.',
    addonIds: ['guardrails'],
    meterSkuIds: ['browser-proof'],
    pilotIds: [],
  },
  'agentcache-knowledge': {
    revenueMotions: ['add_on', 'usage_meter'],
    minimumPlan: 'pro',
    checkoutUrl: '/addons.html?addon=knowledge',
    billingNote: 'Available as a Pro add-on and bundled into Enterprise, with evidence claims estimated as Knowledge credits.',
    addonIds: ['knowledge'],
    meterSkuIds: ['evidence-claim'],
    pilotIds: [],
  },
  'execution-drift-guard': {
    revenueMotions: ['subscription', 'design_partner_pilot', 'usage_meter'],
    minimumPlan: 'pro',
    checkoutUrl: '/contact.html?interest=execution-drift-guard',
    billingNote: 'Included in Pro for core monitoring; high-touch rollout is sold as a paid pilot.',
    addonIds: [],
    meterSkuIds: ['hardening-assessment'],
    pilotIds: ['execution-drift-guard-pilot'],
  },
  'agent-storage-core': {
    revenueMotions: ['design_partner_pilot', 'usage_meter'],
    minimumPlan: 'enterprise',
    checkoutUrl: '/contact.html?interest=agent-storage-core',
    billingNote: 'Sold as an enterprise design-partner pilot with storage, egress, and media usage meters.',
    addonIds: [],
    meterSkuIds: ['storage-gb-month', 'storage-egress-gb', 'transcode-minute'],
    pilotIds: ['agent-storage-core-pilot'],
  },
};

function requireTier(planId: AgenticPlanId): Tier {
  const tier = getTier(planId);
  if (!tier) {
    throw new Error(`Missing tier configuration for ${planId}`);
  }
  return tier;
}

function limit(value: number): LimitValue {
  return value === -1 ? 'unlimited' : value;
}

function ttlDays(tier: Tier): LimitValue {
  if (tier.features.ttlMax === -1) {
    return 'unlimited';
  }
  return Math.floor(tier.features.ttlMax / (24 * 60 * 60 * 1000));
}

export function canPlanUseAddon(planId: AgenticPlanId, addonId: string): boolean {
  const addon = AGENTIC_ADDONS.find((candidate) => candidate.id === addonId);
  if (!addon) return false;
  return PLAN_POSITION[planId] >= PLAN_POSITION[addon.availableFromPlan];
}

export function getAgenticUpgradePath(planId: AgenticPlanId): AgenticUpgradePath | null {
  if (planId === 'free') {
    return {
      targetPlan: 'pro',
      url: '/upgrade.html?plan=pro',
      reason: 'Unlock private namespaces, semantic cache scale, Drift Guard, and add-on eligibility.',
    };
  }

  if (planId === 'pro') {
    return {
      targetPlan: 'enterprise',
      url: '/contact.html?interest=enterprise',
      reason: 'Unlock unlimited agent slots, bundled Guardrails/Knowledge, custom governance, and storage/media pilots.',
    };
  }

  return null;
}

export function getAgenticCommercialTiers(): AgenticCommercialTier[] {
  return PLAN_ORDER.map((planId) => {
    const tier = requireTier(planId);
    const copy = PLAN_COPY[planId];

    return {
      id: planId,
      name: tier.name,
      priceMonthlyUsd: tier.price,
      quotaRequestsMonthly: tier.quota,
      buyer: copy.buyer,
      productionUse: copy.productionUse,
      includedProducts: copy.includedProducts,
      availableAddons: copy.availableAddons.filter((addonId) => canPlanUseAddon(planId, addonId)),
      limits: {
        agentSlots: limit(tier.features.agentSlots),
        namespaces: limit(tier.features.namespaces),
        pipelineNodes: limit(tier.features.pipelineNodes),
        ttlDays: ttlDays(tier),
      },
      checkoutUrl: copy.checkoutUrl,
      upgrade: getAgenticUpgradePath(planId),
    };
  });
}

export function getProductCommercialModel(productId: string): ProductCommercialModel {
  const fallback: Omit<ProductCommercialModel, 'productId'> = {
    revenueMotions: ['subscription'],
    minimumPlan: 'pro',
    checkoutUrl: '/pricing.html',
    billingNote: 'Commercial model follows the nearest AgentCache plan or enterprise contract.',
    addonIds: [],
    meterSkuIds: [],
    pilotIds: [],
  };
  const model = PRODUCT_COMMERCIAL_MODELS[productId] || fallback;
  return { productId, ...model };
}

export function getAgenticMonetizationSummary() {
  return {
    version: 'agentic-monetization-v1',
    primaryCurrency: 'USD',
    revenueMotions: [
      'subscription',
      'add_on',
      'usage_meter',
      'design_partner_pilot',
    ] as AgenticRevenueMotion[],
    checkout: {
      planUpgradeEndpoint: 'POST /api/billing/upgrade',
      stripeCheckoutEndpoint: 'POST /api/billing/create-checkout',
      billingPortalEndpoint: 'POST /api/billing/portal',
      usageEndpoint: 'GET /api/billing/usage',
    },
    agentGuidance: {
      defaultStart: 'free',
      productionMinimum: 'pro',
      upgradeWhen: [
        'agent needs private namespace isolation',
        'agent exceeds request or active-agent quota',
        'agent needs Guardrails, Knowledge, Drift Guard governance, storage, or media lanes',
      ],
    },
    plans: getAgenticCommercialTiers(),
    addons: AGENTIC_ADDONS,
    meteredSkus: AGENTIC_METERED_SKUS,
    designPartnerPilots: AGENTIC_DESIGN_PARTNER_PILOTS,
  };
}
