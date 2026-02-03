
import { db } from '../../src/db/client.js';
import { userSettings } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    const { method } = req;
    const userId = req.headers.get('x-user-id');

    if (!userId) return new Response('Unauthorized', { status: 401 });

    try {
        if (method === 'GET') {
            const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);

            // Return defaults if no record exists
            return new Response(JSON.stringify(settings || {
                themePref: 'system',
                notificationsEnabled: true,
                sectorConfig: {}
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (method === 'POST') {
            const body = await req.json();
            const { themePref, notificationsEnabled, sectorConfig } = body;

            // Upsert User Settings
            // We use onConflictDoUpdate to handle both create and update
            const result = await db.insert(userSettings)
                .values({
                    userId,
                    themePref,
                    notificationsEnabled,
                    sectorConfig
                })
                .onConflictDoUpdate({
                    target: userSettings.userId,
                    set: {
                        themePref: themePref !== undefined ? themePref : undefined,
                        notificationsEnabled: notificationsEnabled !== undefined ? notificationsEnabled : undefined,
                        sectorConfig: sectorConfig !== undefined ? sectorConfig : undefined,
                        updatedAt: new Date()
                    }
                })
                .returning();

            return new Response(JSON.stringify({ success: true, settings: result[0] }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        console.error("[User Settings API] Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
