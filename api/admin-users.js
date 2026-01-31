import { db } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';

export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, OPTIONS',
            'access-control-allow-headers': 'Content-Type, Authorization',
        },
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        console.log('[AdminUsers] Fetching users...');

        // Add timeout race
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DB_TIMEOUT')), 5000)
        );

        const dbQuery = db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            plan: users.plan,
            status: users.status,
            last_active: users.updatedAt,
            created_at: users.createdAt
        })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(100);

        const allUsers = await Promise.race([dbQuery, timeoutPromise]);

        console.log(`[AdminUsers] Fetched ${allUsers.length} users successfully.`);

        // Map to format expected by Admin.jsx
        const mappedUsers = allUsers.map(u => ({
            id: u.id,
            name: u.name || 'Unknown',
            email: u.email,
            role: u.role || 'user',
            status: u.status || 'active',
            lastActive: u.last_active ? new Date(u.last_active).toLocaleString() : 'N/A'
        }));

        return json({ users: mappedUsers });
    } catch (e) {
        console.error('[AdminUsers] Error:', e);
        // If timeout, return cached/empty list but don't crash 25s later
        if (e.message === 'DB_TIMEOUT') {
            return json({ error: 'Database Timeout', users: [] }, 504);
        }
        return json({ error: 'Database Error', details: e.message }, 500);
    }
}
