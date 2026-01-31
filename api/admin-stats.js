import { statsService } from '../src/services/StatsService.js';

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
        const stats = await statsService.getGlobalStats();
        return json(stats);
    } catch (error) {
        console.error('[AdminStats] Error:', error);
        return json({ error: error.message }, 500);
    }
}
