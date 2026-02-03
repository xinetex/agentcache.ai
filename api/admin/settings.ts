
import { db } from '../../src/db/client.js';
import { systemSettings, users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { parseBody } from '../../lib/request.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    const { method } = req;

    // TODO: Middleware for Admin Check (Authorization: Bearer + Role Check)
    // For now, we rely on x-user-id header and simple role check query
    const userId = req.headers.get('x-user-id');
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
