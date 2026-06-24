
import { db } from '../../src/db/client.js';
import { systemSettings, users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export const config = { runtime: 'nodejs' };

function getHeader(req: any, name: string): string | null {
    if (typeof req.headers?.get === 'function') {
        return req.headers.get(name) || req.headers.get(name.toLowerCase());
    }
    const value = req.headers?.[name.toLowerCase()] || req.headers?.[name];
    return Array.isArray(value) ? value[0] : value || null;
}

function extractBearerToken(req: any): string | null {
    const authHeader = getHeader(req, 'authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length);
}

function isAdminTokenAuthorized(req: any): boolean {
    const configuredToken = process.env.ADMIN_TOKEN;
    if (!configuredToken) return process.env.NODE_ENV !== 'production';

    const suppliedToken = getHeader(req, 'x-admin-token') || extractBearerToken(req);
    return suppliedToken === configuredToken;
}

export default async function handler(req) {
    const { method } = req;

    if (!isAdminTokenAuthorized(req)) {
        return new Response('Unauthorized - Admin token required', { status: 401 });
    }

    const userId = getHeader(req, 'x-user-id');
    if (!userId) return new Response('Unauthorized', { status: 401 });

    try {
        // Enforce Admin Role
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user || user.role !== 'admin') {
            return new Response('Forbidden: Admin Access Only', { status: 403 });
        }

        if (method === 'GET') {
            const settings = await db.select().from(systemSettings);

            // Convert array to object for easier frontend consumption
            const settingsMap = settings.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});

            return new Response(JSON.stringify(settingsMap), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (method === 'POST') {
            const body = await req.json();
            const { key, value, description } = body;

            if (!key || value === undefined) {
                return new Response('Missing key or value', { status: 400 });
            }

            // Upsert Setting
            await db.insert(systemSettings)
                .values({
                    key,
                    value,
                    description,
                    updatedBy: userId,
                    updatedAt: new Date()
                })
                .onConflictDoUpdate({
                    target: systemSettings.key,
                    set: {
                        value,
                        description: description || undefined, // Only update desc if provided
                        updatedBy: userId,
                        updatedAt: new Date()
                    }
                });

            return new Response(JSON.stringify({ success: true, key, value }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        console.error("[Admin Settings API] Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
