import { describe, expect, it } from 'vitest';
import {
  buildQuotaExceededPayload,
  buildRateLimitPayload,
  getDefaultQuotaForPlan,
  getPlanMetadata,
  getUpgradeDetails,
  normalizePublicPlanId,
} from '../../src/lib/upgrade-response.js';

describe('upgrade response helpers', () => {
  it('normalizes internal and public plan ids', () => {
    expect(normalizePublicPlanId('starter')).toBe('free');
    expect(normalizePublicPlanId('professional')).toBe('pro');
    expect(normalizePublicPlanId('pro')).toBe('pro');
    expect(normalizePublicPlanId('enterprise')).toBe('enterprise');
  });

  it('returns quota defaults and next upgrade details', () => {
    expect(getDefaultQuotaForPlan('free')).toBe(10_000);
    expect(getDefaultQuotaForPlan('pro')).toBe(1_000_000);
    expect(getUpgradeDetails('free')).toMatchObject({
      currentPlan: 'free',
      recommendedPlan: 'pro',
      upgradeUrl: '/upgrade.html?plan=pro',
    });
  });

  it('builds structured quota and rate-limit payloads', () => {
    expect(buildQuotaExceededPayload({
      currentPlan: 'pro',
      used: 1_200_000,
      quota: 1_000_000,
    })).toMatchObject({
      code: 'MONTHLY_QUOTA_EXCEEDED',
      recommendedPlan: 'enterprise',
      upgradeRequired: true,
    });

    expect(buildRateLimitPayload({
      currentPlan: 'free',
      limit: 500,
      window: 'minute',
    })).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      recommendedPlan: 'pro',
      limit: 500,
    });
  });
});
