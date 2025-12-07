
export const config = { runtime: 'nodejs' };

/**
 * Returns real server geography and connectivity status.
 */
export default async function handler(req) {
    // 1. Get Real Region
    const region = process.env.VERCEL_REGION || 'dev1';

    // 2. Measure "Real" Connectivity
    // We ping a few public reliable endpoints to get "Real World" latency stats.
    // This isn't fake data; it's the actual server performing a health check.

    const targets = [
        { name: 'Cloudflare DNS', url: 'https://1.1.1.1' },
        { name: 'Google DNS', url: 'https://8.8.8.8' }
    ];

    const checks = await Promise.all(targets.map(async (t) => {
        const start = performance.now();
        try {
            await fetch(t.url, { method: 'HEAD' });
            return { name: t.name, status: 'online', latency: Math.round(performance.now() - start) };
        } catch (e) {
            return { name: t.name, status: 'offline', latency: 0 };
        }
    }));

    // 3. Construct "Real World" Payload
    const data = {
        server: {
            region: region,
            timestamp: new Date().toISOString(),
            status: 'operational'
        },
        connectivity: checks
    };

    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
    });
}
