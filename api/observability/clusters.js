
export const config = { runtime: 'nodejs' };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
    const path = `${command}/${args.map(a => encodeURIComponent(String(a))).join('/')}`;
    const res = await fetch(`${UPSTASH_URL}/${path}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    return await res.json();
}

export default async function handler(req) {
    try {
        // 1. Scan for recent traces to build clusters
        // In a real production app we would maintain a secondary index for this.
        // For this demo of "Real Data", we'll scan the top 100 recent traces.
        // This gives us a statistical sample of what's happening NOW.

        const recentTracesRes = await redis('lrange', 'traces:recent', 0, 99);
        const traceStrings = recentTracesRes.result || [];

        const clusters = {};

        // 2. Aggregate Data
        traceStrings.forEach(str => {
            try {
                const t = JSON.parse(str);
                // Cluster by "Provider:Model" (e.g., openai:gpt-4)
                const key = `${t.provider}:${t.model}`;

                if (!clusters[key]) {
                    clusters[key] = {
                        id: key,
                        label: `${t.provider} / ${t.model}`,
                        count: 0,
                        totalCost: 0,
                        avgLatency: 0,
                        queries: [],
                        state: 'liquid' // default
                    };
                }

                const c = clusters[key];
                c.count++;
                c.totalCost += (t.cost || 0);
                // Running average for latency
                c.avgLatency = ((c.avgLatency * (c.count - 1)) + t.latency) / c.count;

                // Keep unique queries (up to 5)
                if (c.queries.length < 5 && !c.queries.includes(t.model)) {
                    // We don't have the raw query in the trace for privacy, 
                    // so we'll use the unique ID or a placeholder if available.
                    // For now, let's just count them.
                }
            } catch (e) { /* ignore parse error */ }
        });

        // 3. Format for Frontend
        const clusterArray = Object.values(clusters).map((c, i) => ({
            ...c,
            size: Math.min(100, Math.max(20, c.count * 10)), // Scale size by activity
            x: (i * 30 + 20) % 80, // deterministically scatter for now
            y: (i * 20 + 30) % 80,
            color: c.label.includes('gpt-4') ? 'bg-purple-500' : 'bg-cyan-500'
        }));

        if (clusterArray.length === 0) {
            // If absolutely no data, return empty array. The frontend handles this (shows "No Signal").
            return new Response(JSON.stringify([]), { status: 200 });
        }

        return new Response(JSON.stringify(clusterArray), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
