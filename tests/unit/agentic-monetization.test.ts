import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

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
      'one_time_service',
    ]);
    expect(monetization.addons.map((addon) => addon.id)).toEqual(['guardrails', 'knowledge']);
    expect(monetization.meteredSkus.some((sku) => sku.id === 'memory-fabric-credit')).toBe(true);
    expect(monetization.oneTimeOffers).toContainEqual(expect.objectContaining({
      id: 'agent-run-risk-savings-audit',
      priceUsd: 750,
      checkoutEndpoint: 'POST /api/audit/checkout',
    }));
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

    expect(getProductCommercialModel('agent-run-risk-savings-audit')).toMatchObject({
      minimumPlan: 'free',
      checkoutUrl: '/agent-audit',
      billingNote: expect.stringContaining('$750'),
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

  it('keeps the audit page connected to the priced offer and checkout path', () => {
    const page = readFileSync(new URL('../../public/agent-audit.html', import.meta.url), 'utf8');
    expect(page).toContain('$750');
    expect(page).toContain("fetch('/api/audit/checkout'");
    expect(page).toContain('site refund terms apply');
    expect(page).toContain('scope_acknowledged');
    expect(page).toContain('30-minute findings readout');
  });
});
