import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { apiKeys, members, users } from '../src/db/schema.js';
import { verifyToken } from '../lib/jwt.js';
import { parseBody } from '../lib/request.js';
import { invalidateApiKeyAuthenticationCache } from '../src/middleware/auth.js';

export const config = { runtime: 'nodejs' };

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
}

function getAuthenticatedSession(req: any): { userId: string; organizationId: string | null } | null {
    const authorization = req.headers?.authorization || req.headers?.get?.('authorization');
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
    const payload: any = verifyToken(authorization.slice(7));
    return typeof payload?.userId === 'string'
        ? { userId: payload.userId, organizationId: typeof payload.organizationId === 'string' ? payload.organizationId : null }
        : null;
}

export default async function handler(req: any) {
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
        return json({ error: 'Account settings are temporarily unavailable.' }, 503);
    }
    const session = getAuthenticatedSession(req);
    if (!session) return json({ error: 'Authentication required.' }, 401);
    const userId = session.userId;

    try {
        const userRows = await db.select({ id: users.id, name: users.name, email: users.email })
            .from(users).where(eq(users.id, userId)).limit(1);
        const user = userRows[0];
        if (!user) return json({ error: 'Authenticated user not found.' }, 401);

        const memberships = await db.select({ orgId: members.orgId, role: members.role })
            .from(members).where(eq(members.userId, userId));
        const membership = memberships.find((item) => item.orgId === session.organizationId) || memberships.find((item) => item.orgId);

        if (req.method === 'GET') {
            const url = new URL(req.url, 'http://localhost');
            if (url.searchParams.get('type') === 'keys') {
                const keys = await db.select({ id: apiKeys.id, prefix: apiKeys.prefix, created: apiKeys.createdAt, lastUsed: apiKeys.lastUsedAt })
                    .from(apiKeys)
                    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)));
                return json({ keys: keys.map((key) => ({ ...key, value: `${key.prefix}…` })) });
            }
            return json({ profile: { id: user.id, displayName: user.name, email: user.email } });
        }

        if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
        const body = await parseBody(req);

        if (body.action === 'update_profile') {
            if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 120) {
                return json({ error: 'Display name must be between 1 and 120 characters.' }, 400);
            }
            await db.update(users).set({ name: body.displayName.trim() }).where(eq(users.id, userId));
            return json({ success: true });
        }

        if (body.action === 'create_key') {
            if (!membership?.orgId) return json({ error: 'Join an organization before creating an API key.' }, 409);
            const key = `ac_${randomBytes(32).toString('hex')}`;
            const hash = createHash('sha256').update(key).digest('hex');
            const [created] = await db.insert(apiKeys).values({
                orgId: membership.orgId,
                userId,
                prefix: key.slice(0, 16),
                hash,
                name: 'AgentCache console key',
                scopes: ['*'],
                isActive: true,
            }).returning({ id: apiKeys.id, created: apiKeys.createdAt });
            if (!created) return json({ error: 'Could not create API key.' }, 500);
            return json({ success: true, key: { id: created.id, value: key, created: created.created } }, 201);
        }

        if (body.action === 'revoke_key') {
            if (typeof body.keyId !== 'string' || !body.keyId) return json({ error: 'A key ID is required.' }, 400);
            const [ownedKey] = await db.select({ hash: apiKeys.hash })
                .from(apiKeys)
                .where(and(eq(apiKeys.id, body.keyId), eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
                .limit(1);
            if (!ownedKey) return json({ error: 'API key not found.' }, 404);
            const revoked = await db.update(apiKeys)
                .set({ isActive: false, revokedAt: new Date() })
                .where(and(eq(apiKeys.id, body.keyId), eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
                .returning({ id: apiKeys.id });
            if (!revoked.length) return json({ error: 'API key not found.' }, 404);
            await invalidateApiKeyAuthenticationCache(ownedKey.hash).catch((error) => {
                console.error('[Settings API] API key cache invalidation failed:', error?.message || 'unknown error');
            });
            return json({ success: true });
        }

        return json({ error: 'Unknown settings action.' }, 400);
    } catch (error: any) {
        console.error('[Settings API] Request failed:', error?.message || 'unknown error');
        return json({ error: 'Could not complete the settings request.' }, 500);
    }
}
