import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db } from '../../src/db/client.js';
import { members, users, apiKeys } from '../../src/db/schema.js';
import { generateToken } from '../../lib/jwt.js';
import settingsHandler from '../../api/settings.js';

describe('settings API member key issuance', () => {
  it('rejects caller-supplied user identity without a signed session', async () => {
    const response = await settingsHandler({
      method: 'POST', url: '/api/settings', headers: { 'x-user-id': randomUUID() },
      body: { action: 'create_key' },
    });
    expect(response.status).toBe(401);
  });

  it('fails closed when production JWT signing is not configured', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousJwtSecret = process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    try {
      const response = await settingsHandler({ method: 'GET', url: '/api/settings', headers: {} });
      expect(response.status).toBe(503);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousJwtSecret;
    }
  });

  it('creates a user-attributed key and returns the secret only once', async () => {
    const userId = randomUUID();
    const organizationId = randomUUID();
    await db.insert(users).values({ id: userId, email: `${userId}@test.invalid`, name: 'Key Owner' });
    await db.insert(members).values({ id: randomUUID(), userId, orgId: organizationId, role: 'owner' });

    const response = await settingsHandler({
      method: 'POST', url: '/api/settings',
      headers: { authorization: `Bearer ${generateToken({ id: userId, email: `${userId}@test.invalid` })}` },
      body: { action: 'create_key' },
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.key.value).toMatch(/^ac_[a-f0-9]{64}$/);
    expect(payload.key.value).toHaveLength(67);

    const keyHash = createHash('sha256').update(payload.key.value).digest('hex');
    const storedRows = await db.select().from(apiKeys);
    const stored = storedRows.find((row: any) => row.hash === keyHash);
    expect(stored).toMatchObject({ userId, orgId: organizationId, prefix: payload.key.value.slice(0, 16), hash: keyHash });
    expect(JSON.stringify(payload)).not.toContain(keyHash);

    const revokeResponse = await settingsHandler({
      method: 'POST', url: '/api/settings',
      headers: { authorization: `Bearer ${generateToken({ id: userId })}` },
      body: { action: 'revoke_key', keyId: payload.key.id },
    });
    expect(revokeResponse.status).toBe(200);
    const afterRevoke = (await db.select().from(apiKeys)).find((row: any) => row.id === payload.key.id);
    expect(afterRevoke).toMatchObject({ isActive: false, userId });
    expect(afterRevoke.revokedAt).toBeInstanceOf(Date);
  });
});
