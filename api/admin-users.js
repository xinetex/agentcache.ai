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
        const allUsers = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            plan: users.plan,
            status: users.status, // Ensure status is selected if available
            last_active: users.updatedAt, // Use updatedAt as proxy for lastActive
            created_at: users.createdAt
        })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(100);

        // Map to format expected by Admin.jsx (if different)
        // Admin.jsx expects: id, name, email, role, status, lastActive
        const mappedUsers = allUsers.map(u => ({
            id: u.id,
            name: u.name || 'Unknown',
            email: u.email,
            role: u.role || 'user',
            status: u.status || 'active', // Default to active if missing
            lastActive: u.last_active ? new Date(u.last_active).toLocaleString() : 'N/A'
        }));

        return json({ users: mappedUsers });
    } catch (e) {
        console.error('[AdminUsers] Error:', e);
        return json({ error: 'Database Error', details: e.message }, 500);
    }
}
