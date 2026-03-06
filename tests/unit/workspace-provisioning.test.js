import { describe, expect, it } from 'vitest';

import {
  generateApiKey,
  generateWorkspaceName,
  getKeyPrefix,
  getPlanLimits,
  hashApiKey,
  slugify,
} from '../../lib/workspace-provisioning.js';

describe('workspace provisioning helpers', () => {
  it('normalizes slugs and falls back safely', () => {
    expect(slugify('Acme Corp / Finance')).toBe('acme-corp-finance');
    expect(slugify('')).toBe('workspace');
  });

  it('builds a readable workspace name', () => {
    expect(generateWorkspaceName('Jane Doe', 'jane@example.com')).toBe("Jane Doe's Workspace");
    expect(generateWorkspaceName('', 'team.ops@example.com')).toBe("team ops's Workspace");
  });

  it('returns bounded plan defaults', () => {
    expect(getPlanLimits('starter')).toEqual({ maxNamespaces: 5, maxApiKeys: 3, maxUsers: 5 });
    expect(getPlanLimits('professional')).toEqual({ maxNamespaces: 10, maxApiKeys: 10, maxUsers: 25 });
    expect(getPlanLimits('unknown')).toEqual({ maxNamespaces: 5, maxApiKeys: 3, maxUsers: 5 });
  });

  it('derives key metadata from generated keys', () => {
    const apiKey = generateApiKey();
    expect(apiKey.startsWith('ac_live_')).toBe(true);
    expect(getKeyPrefix(apiKey)).toBe(apiKey.slice(0, 16));
    expect(hashApiKey(apiKey)).toHaveLength(64);
  });
});
