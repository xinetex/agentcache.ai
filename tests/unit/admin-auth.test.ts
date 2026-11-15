import { afterEach, describe, expect, it } from 'vitest';
import { authenticateAdmin } from '../../src/middleware/auth.js';

const previousAdminToken = process.env.ADMIN_TOKEN;

afterEach(() => {
  if (previousAdminToken === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = previousAdminToken;
});

function mockContext(headers: Record<string, string> = {}) {
  const values = new Map<string, unknown>();
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()] ?? headers[name],
      path: '/api/provision/jettythunder',
    },
    json: (body: unknown, status = 200) => ({ body, status }),
    set: (name: string, value: unknown) => values.set(name, value),
    values,
  };
}

describe('authenticateAdmin', () => {
  it('fails closed when the admin token is not configured', async () => {
    delete process.env.ADMIN_TOKEN;
    const result = await authenticateAdmin(mockContext() as any);
    expect(result).toMatchObject({ status: 503, body: { error: 'Admin access disabled (Configuration Error)' } });
  });

  it('rejects missing, wrong, and different-length credentials', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    for (const token of [undefined, 'wrong-token', 'short']) {
      const context = mockContext(token ? { 'X-Admin-Token': token } : {});
      const result = await authenticateAdmin(context as any);
      expect(result).toMatchObject({ status: 403, body: { error: 'Unauthorized: Admin access required' } });
      expect(context.values.has('adminCredentialId')).toBe(false);
    }
  });

  it('accepts the configured token and records only a hashed credential identifier', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const context = mockContext({ 'X-Admin-Token': 'secret-token' });
    expect(await authenticateAdmin(context as any)).toBeNull();
    expect(String(context.values.get('adminCredentialId'))).toMatch(/^admin-token:[a-f0-9]{16}$/);
    expect(String(context.values.get('adminCredentialId'))).not.toContain('secret-token');
  });
});
