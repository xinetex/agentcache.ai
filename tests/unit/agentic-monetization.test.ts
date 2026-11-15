import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  canPlanUseAddon,
  AGENTIC_ADDONS,
  AGENTIC_DESIGN_PARTNER_PILOTS,
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
    const governedActionSku = monetization.meteredSkus.find((sku) => sku.id === 'governed-action');
    expect(governedActionSku).toMatchObject({ billingMode: 'pilot_meter', minimumPlan: 'pro' });
    expect(governedActionSku?.pricing).toContain('Denied, failed, and incomplete calls are not billable');
    expect(monetization.meteredSkus.find((sku) => sku.id === 'certified-run'))
      .toMatchObject({ billingMode: 'pilot_meter' });
    expect(getProductCommercialModel('execution-drift-guard').revenueMotions).not.toContain('usage_meter');
    expect(monetization.designPartnerPilots.find((pilot) => pilot.id === 'execution-drift-guard-pilot')?.includedVolume)
      .toContain('One agreed workflow');
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
    expect(manifest.payments).toMatchObject({ enabled: false, status: 'disabled' });
    expect(manifest.x402_payment_protocol).toMatchObject({ supported: false, status: 'disabled' });
    expect(skillMd).toContain('GET /api/billing/monetization');
    expect(skillMd).toContain('AgentCache monetizes agentic use through subscriptions');
    expect(skillMd).toContain('x402 machine-to-machine settlement is currently disabled');
  });

  it('positions the public hub around governed execution without promising crypto payouts', () => {
    const hub = readFileSync(new URL('../../public/hub.html', import.meta.url), 'utf8');
    const skill = readFileSync(new URL('../../public/skill.md', import.meta.url), 'utf8');
    const services = readFileSync(new URL('../../public/services.html', import.meta.url), 'utf8');
    const generatedSkill = generateSkillMd();

    expect(hub).toContain('Governed execution for agent teams');
    expect(hub).toContain('The current provider pilot is an aggregate-only JettyThunder storage summary.');
    expect(hub).not.toContain('Give every agent action');
    expect(hub).toContain('Policy Before Action');
    expect(hub).toContain('href="/execution.html"');
    expect(hub).not.toContain('sampleAgents');
    expect(hub).not.toContain('Optimizer-X7');
    expect(hub).not.toContain('get paid in USDC');
    expect(skill).toContain('does not currently process USDC');
    expect(skill).toContain('Governed Execution');
    expect(generatedSkill).toContain('Governed Execution');
    expect(generatedSkill).toContain('not a general external MCP proxy');
    expect(services).toContain('Find and request supporting capabilities');
    expect(services).toContain('href="/execution.html">Open execution console');
    expect(services).not.toContain('Join the agent economy');
    expect(services).not.toContain('Register Agent');
    expect(services).toContain('does not intercept arbitrary provider or MCP traffic');
  });

  it('keeps the audit page connected to the priced offer and checkout path', () => {
    const page = readFileSync(new URL('../../public/agent-audit.html', import.meta.url), 'utf8');
    expect(page).toContain('$750');
    expect(page).toContain("fetch('/api/audit/checkout'");
    expect(page).toContain('site refund terms apply');
    expect(page).toContain('scope_acknowledged');
    expect(page).toContain('30-minute findings readout');
  });

  it('keeps public pilot scope, credential ownership, and retention claims aligned with the offer', () => {
    const pilot = AGENTIC_DESIGN_PARTNER_PILOTS.find((item) => item.id === 'execution-drift-guard-pilot');
    const auditPage = readFileSync(new URL('../../public/agent-audit.html', import.meta.url), 'utf8');
    const pricingPage = readFileSync(new URL('../../public/pricing.html', import.meta.url), 'utf8');
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');

    expect(pilot).toMatchObject({ priceMonthlyUsd: 1500, term: '90-day paid pilot.' });
    expect(auditPage).toContain('one agreed workflow and one initial provider adapter');
    expect(auditPage).toContain('action cap, support cadence, and provider pass-through costs');
    expect(auditPage).not.toContain('50,000 evaluated runs');
    expect(pricingPage).toContain('Connect provider accounts you own; no pooled AgentCache tool wallet');
    expect(pricingPage).toContain('Guardrails');
    expect(pricingPage).toContain('Knowledge');
    expect(pricingPage).toContain(`$${AGENTIC_ADDONS.find((addon) => addon.id === 'guardrails')?.priceMonthlyUsd}/mo listed`);
    expect(pricingPage).toContain(`$${AGENTIC_ADDONS.find((addon) => addon.id === 'knowledge')?.priceMonthlyUsd}/mo listed`);
    expect(pricingPage).not.toContain('DriftWalker Pro');
    expect(pricingPage).not.toContain('Safety Sentry');
    expect(pricingPage).toContain('Data retention depends on the service and agreement');
    expect(pricingPage).not.toContain('retained for 30 days');
    expect(readme).toContain('Solo Pilot (Free)');
    expect(readme).toContain('Swarm Fleet (Pro)');
    expect(readme).toContain('Cognitive Cluster (Enterprise)');
  });
});
