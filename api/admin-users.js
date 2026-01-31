import { userService } from '../src/services/UserService.js';

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
        const users = await userService.getAllUsers();
        return json({ users });
    } catch (e) {
        console.error('[AdminUsers] Error:', e);
        if (e.message === 'DB_TIMEOUT') {
            return json({ error: 'Database Timeout', users: [] }, 504);
        }
        return json({ error: 'Database Error', details: e.message }, 500);
    }
}
