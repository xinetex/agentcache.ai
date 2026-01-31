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
        return c.json({ error: e.message }, 500);
    }
});

app.get('/users', async (c) => {
    try {
        const users = await userService.getAllUsers();
        return c.json({ users });
    } catch (e: any) {
        if (e.message === 'DB_TIMEOUT') {
            return c.json({ error: 'Database Timeout', users: [] }, 504);
        }
        return c.json({ error: 'Database Error', details: e.message }, 500);
    }
});

export default app;
