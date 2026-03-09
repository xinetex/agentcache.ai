import { describe, expect, it } from 'vitest';

import {
  compareInternalPlans,
  getBillingPlanByInternalTier,
  getBillingPlanByPublicId,
  getBillingPlanByStripePriceId,
  getPlanRank,
  getPublicPlanIdFromInternalTier,
  getQuotaForInternalPlan,
} from '../../lib/billing-plans.js';

describe('billing plan helpers', () => {
  it('maps internal tiers to public plans consistently', () => {
    expect(getPublicPlanIdFromInternalTier('starter')).toBe('free');
    expect(getPublicPlanIdFromInternalTier('professional')).toBe('pro');
    expect(getPublicPlanIdFromInternalTier('enterprise')).toBe('enterprise');
  });

  it('returns quota snapshots from internal tiers', () => {
    expect(getQuotaForInternalPlan('starter')).toBe(10_000);
    expect(getQuotaForInternalPlan('professional')).toBe(1_000_000);
    expect(getQuotaForInternalPlan('enterprise')).toBe(10_000_000);
  });

  it('compares plans in ascending order', () => {
    expect(getPlanRank('starter')).toBeLessThan(getPlanRank('professional'));
    expect(compareInternalPlans('enterprise', 'professional')).toBeGreaterThan(0);
    expect(compareInternalPlans('starter', 'starter')).toBe(0);
  });

  it('looks up plans by public id, internal tier, and Stripe price id', () => {
    const proPlan = getBillingPlanByPublicId('pro');

    expect(getBillingPlanByInternalTier('professional')?.publicId).toBe('pro');
    expect(getBillingPlanByStripePriceId(proPlan?.stripeMonthlyPriceId)?.publicId).toBe('pro');
  });
});
