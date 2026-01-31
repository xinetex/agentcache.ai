import { Hono } from 'hono';
import { statsService } from '../services/StatsService.js';
import { userService } from '../services/UserService.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { redis } from '../lib/redis.js';

const app = new Hono();

// Auth Middleware (Optional for now as discussed)
// app.use('*', authMiddleware); 

app.get('/settings', async (c) => {
    try {
        const settings = await redis.get('adminConfig:settings');
        return c.json(settings ? JSON.parse(settings as string) : {});
    } catch (e: any) {
        console.warn('Failed to fetch settings:', e);
        return c.json({});
    }
});

app.post('/settings', async (c) => {
    try {
        const body = await c.req.json();
        // Basic validation could go here
        await redis.set('adminConfig:settings', JSON.stringify(body));
        return c.json({ success: true });
    } catch (e: any) {
        console.error('Failed to save settings:', e);
        return c.json({ error: 'Failed to save settings' }, 500);
    }
});

app.get('/stats', async (c) => {
    // ... (existing code)
    try {
        const stats = await statsService.getGlobalStats();
        return c.json(stats);
    } catch (e: any) {
        console.warn('Failed to fetch stats:', e);
        // Fallback to safe zero-stats
        return c.json({
            total_users: 0,
            active_sessions: 0,
            system_health: 'OFFLINE',
            cache_hits_today: 0,
            cost_saved_today: "$0.00"
        });
    }
});

app.get('/users', async (c) => {
    try {
        const users = await userService.getAllUsers();
        return c.json({ users });
    } catch (e: any) {
        console.warn('Failed to fetch users:', e);
        // Fallback to empty list (200 OK) to prevent UI crash
        return c.json({ users: [] });
    }
});

export default app;
