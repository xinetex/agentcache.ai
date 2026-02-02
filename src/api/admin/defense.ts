import { Hono } from 'hono';

export const defenseRouter = new Hono();

// Mock Security Log
defenseRouter.get('/stats', async (c) => {
    return c.json({
        firewall_status: 'ACTIVE',
        threat_level: 'LOW',
        active_rules: 124,
        blocked_ips_count: 85,
        daily_attacks_prevented: 12,
        recent_events: [
            { id: 101, type: 'PROMPT_INJECTION', source: '203.0.113.45', severity: 'HIGH', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), details: 'Simulated jailbreak attempt' },
            { id: 102, type: 'RATE_LIMIT', source: '198.51.100.2', severity: 'MEDIUM', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), details: 'Exceeded 100 req/min' },
            { id: 103, type: 'SQL_INJECTION', source: '192.0.2.1', severity: 'CRITICAL', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), details: 'Blocked by WAF' },
            { id: 104, type: 'AUTH_FAILURE', source: 'admin-login', severity: 'LOW', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), details: 'Invalid password' },
            { id: 105, type: 'SCANNER', source: '45.33.22.11', severity: 'MEDIUM', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), details: 'Port 443 sweep' },
        ]
    });
});
