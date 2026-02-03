
export default async function handler(req, res) {
    // 1. Parse Cursor (for live tailing)
    // If client sends ?since=TIMESTAMP, only return logs after that.
    const sinceParam = req.query.since;
    const since = sinceParam ? parseInt(sinceParam) : Date.now() - (1000 * 60 * 60); // Default last 1h

    // 2. Generate/Fetch Logs
    // In production, this would be: await db.select().from(logs).where(gt(logs.timestamp, since));

    // Simulation Logic:
    const logs = [];
    const now = Date.now();
    const count = sinceParam ? Math.floor(Math.random() * 3) : 20; // Initial load: 20, Live: 0-2 items

    for (let i = 0; i < count; i++) {
        // If initial load, spread them out. If live, they are recent.
        const offset = sinceParam ? Math.random() * 1000 : Math.random() * (1000 * 60 * 60);

        logs.push(generateRandomLog(now - offset));
    }

    // Sort ascending (oldest first) so the terminal flows down
    logs.sort((a, b) => a.timestamp - b.timestamp);

    return res.status(200).json({
        logs: logs,
        cursor: now // Client waits and sends this back as 'since'
    });
}

function generateRandomLog(timestamp) {
    const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'SUCCESS', 'ERROR'];
    const sources = ['Auth', 'System', 'Marketplace', 'Stripe', 'Node-1', 'TrustBroker'];
    const messages = [
        'User authentication attempt verified',
        'Cache item evicted due to TTL policy',
        'New agent registered in marketplace',
        'Webhook delivery successful',
        'Rate limit approaching for IP 10.0.0.12',
        'Database connection pool replenished',
        'Background job [Sync-Sectors] completed',
        'Health check passed: All systems nominal',
        'Latency spike detected in region us-east-1',
        'Payment intent created successfully'
    ];

    const level = levels[Math.floor(Math.random() * levels.length)];
    const colorMap = {
        'INFO': 'text-blue-400',
        'WARN': 'text-amber-400',
        'SUCCESS': 'text-emerald-400',
        'ERROR': 'text-red-400'
    };

    return {
        id: Math.random().toString(36).substring(7),
        timestamp: timestamp,
        timestampStr: new Date(timestamp).toLocaleTimeString([], { hour12: false }),
        level: level,
        levelColor: colorMap[level] || 'text-gray-400',
        source: sources[Math.floor(Math.random() * sources.length)],
        message: messages[Math.floor(Math.random() * messages.length)]
    };
}
