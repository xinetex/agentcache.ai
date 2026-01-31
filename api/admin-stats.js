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

const getEnv = () => ({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
    const { url, token } = getEnv();
    if (!url || !token) throw new Error('Upstash not configured');
    const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
    const res = await fetch(`${url}/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = await res.json();
    return data.result;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        // Parallel Fetch for Performance
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('REDIS_TIMEOUT')), 5000));

        const redisPromise = Promise.all([
            redis('SCARD', 'subscribers'),
            redis('SCARD', 'subscribers:pending'),
            redis('SCARD', 'waitlist'),
            redis('SCARD', 'keys:active'),
            redis('GET', `stats:global:hits:d:${today}`),
            redis('GET', `stats:global:misses:d:${today}`),
            redis('GET', `stats:global:tokens:d:${today}`)
        ]);

        const [
            subscribers,
            pending,
            waitlist,
            activeKeys,
            hitsToday,
            missesToday,
            tokensToday
        ] = await Promise.race([redisPromise, timeoutPromise]);

        const totalUsers = (subscribers || 0) + (pending || 0) + (waitlist || 0);
        const hits = Number(hitsToday || 0);
        const misses = Number(missesToday || 0);
        const totalRequests = hits + misses;
        const hitRate = totalRequests > 0 ? ((hits / totalRequests) * 100).toFixed(1) : 0;
        const costSaved = (Number(tokensToday || 0) * 0.01 / 1000).toFixed(2);

        // Fetch Top Users (Mocked as per original logic)
        const topUsers = [
            { rank: 1, name: 'Clinical-Bot-1', score: 14050, sector: 'Medical' },
            { rank: 2, name: 'Trading-Alpha', score: 9240, sector: 'Finance' },
            { rank: 3, name: 'Legal-Reviewer', score: 8100, sector: 'Legal' },
            { rank: 4, name: 'Code-Linter', score: 4500, sector: 'Dev' },
            { rank: 5, name: 'Creative-Unit', score: 3200, sector: 'Design' }
        ];

        // Growth Chart Data (Mocked)
        const growthData = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return {
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                date: d.toISOString().slice(0, 10),
                users: Math.max(0, totalUsers - (6 - i) * 5)
            };
        });

        const stats = {
            total_users: totalUsers,
            active_sessions: activeKeys || 0, // Mapping keys:active to active_sessions
            system_health: 'OPTIMAL', // Hardcoded as per Admin.jsx expectation roughly
            db_latency: '14ms', // Fake metric for now, or measure redis ping?
            cache_hits_today: hits,
            cache_misses_today: misses,
            hit_rate: Number(hitRate),
            cost_saved_today: `$${costSaved}`,
            top_users: topUsers,
            growth_data: growthData,
            timestamp: now.toISOString()
        };

        return json(stats);

    } catch (error) {
        console.error('[AdminStats] Error:', error);
        return json({ error: error.message }, 500);
    }
}
