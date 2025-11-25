export const config = { runtime: 'nodejs' };

export default async function handler(req) {
    // Verify cron secret (set in Vercel env vars)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    // Get all listeners
    const scanRes = await fetch(`${UPSTASH_URL}/scan/0/match/listener:*/count/1000`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const scanData = await scanRes.json();
    const listenerKeys = scanData.result?.[1] || [];

    let checked = 0;
    let changed = 0;
    const errors = [];

    for (const key of listenerKeys) {
        try {
            // Get listener data
            const getRes = await fetch(`${UPSTASH_URL}/hgetall/${encodeURIComponent(key)}`, {
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
            });
            const getData = await getRes.json();

            if (!getData.result || getData.result.length === 0) continue;

            // Parse listener
            const listener = {};
            for (let i = 0; i < getData.result.length; i += 2) {
                listener[getData.result[i]] = getData.result[i + 1];
            }

            // Check if it's time to check
            const timeSinceLastCheck = Date.now() - parseInt(listener.lastCheck || '0');
            if (timeSinceLastCheck < parseInt(listener.checkInterval)) {
                continue;
            }

            // Fetch URL
            const urlRes = await fetch(listener.url, {
                headers: { 'User-Agent': 'AgentCache-Monitor/1.0 (+https://agentcache.ai)' }
            });
            const content = await urlRes.text();

            // Hash content (semantic hashing)
            const cleaned = content
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '')
                .replace(/\d{13}/g, '')
                .replace(/\d{10}/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(cleaned));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

            checked++;

            // Compare with previous hash
            if (listener.lastHash && newHash !== listener.lastHash) {
                changed++;

                // Invalidate caches if configured
                if (listener.invalidateOnChange === 'true') {
                    await fetch(`${new URL(req.url).origin}/api/cache/invalidate`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': 'cron-internal'  // Use internal key
                        },
                        body: JSON.stringify({
                            namespace: listener.namespace,
                            reason: `url_change:${listener.url}`
                        })
                    });
                }

                // Send webhook if configured
                if (listener.webhook) {
                    await fetch(listener.webhook, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'url_changed',
                            url: listener.url,
                            namespace: listener.namespace,
                            oldHash: listener.lastHash,
                            newHash: newHash,
                            timestamp: Date.now()
                        })
                    }).catch(() => { });
                }
            }

            // Update listener
            await fetch(`${UPSTASH_URL}/hset/${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${UPSTASH_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(['lastCheck', Date.now(), 'lastHash', newHash])
            });

        } catch (err) {
            errors.push({ key, error: err.message });
        }
    }

    return new Response(JSON.stringify({
        success: true,
        checked,
        changed,
        errors: errors.length,
        timestamp: Date.now()
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
