export const config = { runtime: 'edge' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
        },
    });
}

const getEnv = () => ({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
    const { url, token } = getEnv();
    if (!url || !token) return null;
    const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
    try {
        const res = await fetch(`${url}/${path}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.result;
    } catch (e) {
        return null;
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        // 1. System Stats (Simulated for Edge)
        // In a real deployment, this would come from a sidecar or monitoring service.
        const cpuUsage = Math.floor(Math.random() * 15) + 20; // 20-35%
        const memoryUsed = 14.2 + (Math.random() * 0.5); // ~14.2 GB
        const memoryTotal = 64;

        // 2. Cache Stats (Real from Redis)
        // We use a simple counter for demo purposes if specific keys aren't populated
        const totalRequests = await redis('GET', 'stats:total_requests') || 1284;
        const cacheHits = await redis('GET', 'stats:cache_hits') || 1210;
        const hitRate = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(1) : '0.0';

        // 3. Active Agents (Simulated/Real)
        const activeAgents = await redis('SCARD', 'agents:active') || 12;

        // 4. Memory Graph Data (Simulated Structure for Visualization)
        // This would normally come from a graph database or vector store relationships
        const graphData = {
            nodes: [
                { id: 'CORE', group: 1, size: 20 },
                { id: 'AGENT_ALPHA', group: 2, size: 15 },
                { id: 'AGENT_BETA', group: 2, size: 15 },
                { id: 'KNOWLEDGE_BASE', group: 3, size: 18 },
                { id: 'PROJECT_TITAN', group: 4, size: 12 },
                { id: 'ETHICS_MODULE', group: 5, size: 10 },
                { id: 'QUANTUM_COMPUTING', group: 3, size: 14 },
                { id: 'NEURAL_NET', group: 3, size: 14 }
            ],
            links: [
                { source: 'CORE', target: 'AGENT_ALPHA' },
                { source: 'CORE', target: 'AGENT_BETA' },
                { source: 'AGENT_ALPHA', target: 'KNOWLEDGE_BASE' },
                { source: 'AGENT_BETA', target: 'PROJECT_TITAN' },
                { source: 'ETHICS_MODULE', target: 'CORE' },
                { source: 'KNOWLEDGE_BASE', target: 'QUANTUM_COMPUTING' },
                { source: 'KNOWLEDGE_BASE', target: 'NEURAL_NET' },
                { source: 'AGENT_ALPHA', target: 'AGENT_BETA' }
            ]
        };

        return json({
            system: {
                cpu: cpuUsage,
                memory: { used: memoryUsed.toFixed(1), total: memoryTotal },
                status: 'OPTIMAL',
                uptime: '14d 2h 12m'
            },
            cache: {
                hitRate: hitRate,
                latency: Math.floor(Math.random() * 10) + 12, // 12-22ms
                requests: totalRequests
            },
            agents: {
                connected: activeAgents,
                flow: 'STABLE'
            },
            graph: graphData
        });

    } catch (err) {
        return json({ error: 'Failed to fetch studio stats', details: err.message }, 500);
    }
}
