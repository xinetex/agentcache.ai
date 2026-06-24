import { describe, expect, it } from 'vitest';

import {
  canPlanUseAddon,
  getAgenticCommercialTiers,
  getAgenticMonetizationSummary,
  getProductCommercialModel,
} from '../../src/config/agenticMonetization.js';
import { generateAgentsJson, generateSkillMd } from '../../src/lib/hub/discovery.js';

describe('agentic monetization config', () => {
  it('keeps production agent use anchored to Pro and enterprise expansion', () => {
    const tiers = getAgenticCommercialTiers();
    const pro = tiers.find((tier) => tier.id === 'pro');
    const enterprise = tiers.find((tier) => tier.id === 'enterprise');

    expect(pro?.includedProducts).toContain('execution-drift-guard');
    expect(pro?.availableAddons).toEqual(['guardrails', 'knowledge']);
    expect(pro?.upgrade).toMatchObject({ targetPlan: 'enterprise' });
    expect(enterprise?.includedProducts).toContain('agentcache-guardrails');
    expect(enterprise?.includedProducts).toContain('agentcache-knowledge');
  });

  it('defines add-ons, meters, and pilots as machine-readable revenue motions', () => {
    const monetization = getAgenticMonetizationSummary();

    expect(monetization.revenueMotions).toEqual([
      'subscription',
      'add_on',
      'usage_meter',
      'design_partner_pilot',
    ]);
    expect(monetization.addons.map((addon) => addon.id)).toEqual(['guardrails', 'knowledge']);
    expect(monetization.meteredSkus.some((sku) => sku.id === 'memory-fabric-credit')).toBe(true);
    expect(monetization.designPartnerPilots.some((pilot) => pilot.id === 'execution-drift-guard-pilot')).toBe(true);
  });

  it('maps revenue-core products to concrete checkout or contact paths', () => {
    expect(getProductCommercialModel('agentcache-guardrails')).toMatchObject({
      minimumPlan: 'pro',
      checkoutUrl: '/addons.html?addon=guardrails',
      addonIds: ['guardrails'],
    });

    expect(getProductCommercialModel('agent-storage-core')).toMatchObject({
      minimumPlan: 'enterprise',
      checkoutUrl: '/contact.html?interest=agent-storage-core',
      pilotIds: ['agent-storage-core-pilot'],
    });

    expect(canPlanUseAddon('free', 'guardrails')).toBe(false);
    expect(canPlanUseAddon('pro', 'guardrails')).toBe(true);
  });

  it('publishes monetization through agent discovery documents', () => {
    const manifest = generateAgentsJson() as any;
    const skillMd = generateSkillMd();

    expect(manifest.monetization.version).toBe('agentic-monetization-v1');
    expect(manifest.pricing).toBe('https://agentcache.ai/api/pricing');
    expect(skillMd).toContain('GET /api/billing/monetization');
    expect(skillMd).toContain('AgentCache monetizes agentic use through subscriptions');
  });
});
