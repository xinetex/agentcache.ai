import { Hono } from 'hono';
import { redis } from '../lib/redis.js';
import { db } from '../db/client.js'; // If needed for complex queries
import { streamSSE } from 'hono/streaming';

import { authMiddleware, requireRole } from './auth.js';
import { users } from '../db/schema.js';
import { desc } from 'drizzle-orm';

const app = new Hono<{ Variables: { user: any } }>();

app.use('/*', authMiddleware, requireRole('owner'));

app.get('/users', async (c) => {
    try {
        const allUsers = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            plan: users.plan,
            created_at: users.createdAt
        })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(100);

        return c.json({ users: allUsers });
    } catch (e: any) {
        console.error('[AdminStats:Users] Error:', e);
        return c.json({ error: 'Database Error', details: e.message }, 500);
    }
});

app.get('/', async (c) => {
    try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        // Parallel Fetch for Performance
        const [
            subscribers,
            pending,
            waitlist,
            activeKeys,
            hitsToday,
            missesToday,
            tokensToday
        ] = await Promise.all([
            redis.scard('subscribers'),
            redis.scard('subscribers:pending'),
            redis.scard('waitlist'),
            redis.scard('keys:active'),
            redis.get(`stats:global:hits:d:${today}`),
            redis.get(`stats:global:misses:d:${today}`),
            redis.get(`stats:global:tokens:d:${today}`)
        ]);

        const totalUsers = (subscribers || 0) + (pending || 0) + (waitlist || 0);
        const hits = Number(hitsToday || 0);
        const misses = Number(missesToday || 0);
        const totalRequests = hits + misses;
        const hitRate = totalRequests > 0 ? ((hits / totalRequests) * 100).toFixed(1) : 0;
        const costSaved = (Number(tokensToday || 0) * 0.01 / 1000).toFixed(2);

        // Fetch Top Users (Optimized: Using simplified mock or just top usage keys if scanning is too slow)
        // For MVP stability w/o 'KEYS' command:
        const topUsers = [
            { rank: 1, name: 'Clinical-Bot-1', score: 14050, sector: 'Medical' },
            { rank: 2, name: 'Trading-Alpha', score: 9240, sector: 'Finance' },
            { rank: 3, name: 'Legal-Reviewer', score: 8100, sector: 'Legal' },
            { rank: 4, name: 'Code-Linter', score: 4500, sector: 'Dev' },
            { rank: 5, name: 'Creative-Unit', score: 3200, sector: 'Design' }
        ];

        // Growth Chart Data (Mocked for speed if historical keys missing)
        const growthData = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return {
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                date: d.toISOString().slice(0, 10),
                users: Math.max(0, totalUsers - (6 - i) * 5) // Fake historical growth
            };
        });

        const stats = {
            total_users: totalUsers,
            cache_hits_today: hits,
            cache_misses_today: misses,
            hit_rate: Number(hitRate),
            cost_saved_today: `$${costSaved}`,
            top_users: topUsers,
            growth_data: growthData,
            timestamp: now.toISOString()
        };

        return c.json(stats);

    } catch (error: any) {
        console.error('[AdminStats] Error:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default app;
