import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agentConnectionService } from '../../src/services/AgentConnectionService.js';

const ENV_KEY = 'AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY';
const ENV_VERSION = 'AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY_VERSION';
const ENV_KEYRING = 'AGENTCACHE_CONNECTIONS_ENCRYPTION_KEYRING';
const originalEnv = {
  key: process.env[ENV_KEY],
  version: process.env[ENV_VERSION],
  keyring: process.env[ENV_KEYRING],
};

describe('AgentConnectionService', () => {
  beforeEach(() => {
    process.env[ENV_KEY] = Buffer.alloc(32, 9).toString('base64');
    process.env[ENV_VERSION] = 'v1';
    delete process.env[ENV_KEYRING];
  });

  afterEach(() => {
    if (originalEnv.key === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalEnv.key;
    if (originalEnv.version === undefined) delete process.env[ENV_VERSION];
    else process.env[ENV_VERSION] = originalEnv.version;
    if (originalEnv.keyring === undefined) delete process.env[ENV_KEYRING];
    else process.env[ENV_KEYRING] = originalEnv.keyring;
  });

  it('encrypts credentials, returns metadata only, and scopes lookup to the owner', async () => {
    const created = await agentConnectionService.create({
      ownerPrincipalId: 'user:connection-test-owner',
      provider: 'pilot-provider',
      displayName: 'Primary account',
      scopes: ['assets:read'],
      credentials: { accessToken: 'test-provider-secret' },
    });

    expect(JSON.stringify(created)).not.toContain('test-provider-secret');
    expect(created.status).toBe('active');
    expect(created.verificationStatus).toBe('unverified');
    expect(await agentConnectionService.getCredentialsForInvocation(created.id, 'user:other-owner')).toBeNull();
    expect(await agentConnectionService.getCredentialsForInvocation(created.id, 'user:connection-test-owner'))
      .toEqual({ accessToken: 'test-provider-secret' });

    process.env[ENV_KEY] = Buffer.alloc(32, 10).toString('base64');
    process.env[ENV_VERSION] = 'v2';
    process.env[ENV_KEYRING] = JSON.stringify({ v1: Buffer.alloc(32, 9).toString('base64') });
    expect(await agentConnectionService.getCredentialsForInvocation(created.id, 'user:connection-test-owner'))
      .toEqual({ accessToken: 'test-provider-secret' });

    const revoked = await agentConnectionService.revokeOwned(created.id, 'user:connection-test-owner');
    expect(revoked?.status).toBe('revoked');
    expect(await agentConnectionService.getCredentialsForInvocation(created.id, 'user:connection-test-owner')).toBeNull();
  });

  it('fails closed when the encryption key is missing or malformed', async () => {
    delete process.env[ENV_KEY];
    await expect(agentConnectionService.create({
      ownerPrincipalId: 'user:no-key',
      provider: 'pilot-provider',
      scopes: [],
      credentials: { accessToken: 'must-not-store' },
    })).rejects.toThrow('connection_encryption_unavailable');

    process.env[ENV_KEY] = 'too-short';
    await expect(agentConnectionService.create({
      ownerPrincipalId: 'user:bad-key',
      provider: 'pilot-provider',
      scopes: [],
      credentials: { accessToken: 'must-not-store' },
    })).rejects.toThrow('connection_encryption_unavailable');

    process.env[ENV_KEY] = `!${Buffer.alloc(32, 7).toString('base64')}`;
    await expect(agentConnectionService.create({
      ownerPrincipalId: 'user:invalid-base64-key',
      provider: 'pilot-provider',
      scopes: [],
      credentials: { accessToken: 'must-not-store' },
    })).rejects.toThrow('connection_encryption_unavailable');
  });

  it('re-encrypts old connection envelopes before an old key is removed', async () => {
    const created = await agentConnectionService.create({
      ownerPrincipalId: 'user:key-rotation-test',
      provider: 'pilot-provider',
      scopes: ['assets:read'],
      credentials: { accessToken: 'rotation-secret' },
    });

    process.env[ENV_KEY] = Buffer.alloc(32, 11).toString('base64');
    process.env[ENV_VERSION] = 'v2';
    process.env[ENV_KEYRING] = JSON.stringify({ v1: Buffer.alloc(32, 9).toString('base64') });

    const rotated = await agentConnectionService.reencryptOldCredentialsBatch(10);
    expect(rotated).toMatchObject({ examined: 1, reencrypted: 1, conflicts: 0, hasMore: false });

    delete process.env[ENV_KEYRING];
    expect(await agentConnectionService.getCredentialsForInvocation(created.id, 'user:key-rotation-test'))
      .toEqual({ accessToken: 'rotation-secret' });
    expect(JSON.stringify(rotated)).not.toContain('rotation-secret');
  });
});
