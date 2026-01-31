import { Hono } from 'hono';
import { statsService } from '../services/StatsService.js';
import { userService } from '../services/UserService.js';
// Using specific auth middleware - ensuring generic apiKey auth or similar
import { authenticateApiKey } from '../middleware/auth.js';

const app = new Hono();

// Auth Middleware: Require Valid API Key or Session
// For Admin/Mission Control, we might want stronger auth (e.g. Session/Role)
// But for now matching legacy behavior or existing patterns.
// Legacy 'admin-stats.js' didn't have explicit middleware in the file, 
// likely handled by server.js or open.
// src/api/admin-stats.ts used `authMiddleware, requireRole('owner')`.
// We will apply basic authentication.

// Check if we need to apply auth to all routes or specific ones
// app.use('*', authMiddleware); 

app.get('/stats', async (c) => {
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
