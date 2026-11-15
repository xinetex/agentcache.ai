import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAgentCacheApiKey } from '../../src/mcp/config.js';

describe('AgentCache MCP credential configuration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('prefers a per-client key over environment configuration', () => {
    vi.stubEnv('AGENTCACHE_API_KEY', 'ac_env_key');
    expect(getAgentCacheApiKey(' ac_client_key ')).toBe('ac_client_key');
  });

  it('supports the explicit AgentCache environment variable', () => {
    vi.stubEnv('AGENTCACHE_API_KEY', ' ac_env_key ');
    vi.stubEnv('API_KEY', 'ac_legacy_key');
    expect(getAgentCacheApiKey()).toBe('ac_env_key');
  });

  it('fails closed when no key is configured', () => {
    vi.stubEnv('AGENTCACHE_API_KEY', '');
    vi.stubEnv('API_KEY', '');
    expect(() => getAgentCacheApiKey()).toThrow('AGENTCACHE_API_KEY is required');
  });
});
