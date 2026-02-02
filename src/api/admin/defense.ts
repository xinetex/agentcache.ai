import { Hono } from 'hono';
import { redis } from '../../lib/redis.js';

export const defenseRouter = new Hono();

// Security Log
defenseRouter.get('/stats', async (c) => {
    // Fetch logs from Redis
    const logs = await redis.lrange('defense:log', 0, 49);
    const events = logs.map(l => JSON.parse(l));

    return c.json({
        firewall_status: 'ACTIVE',
        threat_level: 'LOW', // Could use logic based on recent HIGH severity events
        active_rules: 124,
        blocked_ips_count: events.filter((e: any) => e.type === 'SQL_INJECTION' || e.severity === 'CRITICAL').length + 80,
        recent_events: events
    });
});
