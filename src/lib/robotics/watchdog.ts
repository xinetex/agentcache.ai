import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface Listener {
    id: string;
    url: string;
    checkInterval: number;
    lastCheck: number;
    lastHash: string;
    namespace: string;
    invalidateOnChange: boolean;
    webhook?: string;
    apiKeyHash: string; // Added to track ownership
}

interface CheckResult {
    listenerId: string;
    url: string;
    changed: boolean;
    oldHash: string;
    newHash: string;
    error?: string;
}

async function hashContent(content: string): Promise<string> {
    // Clean content (remove scripts, styles, timestamps) to avoid false positives
    let cleaned = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '') // ISO Dates
        .replace(/\d{13}/g, '') // Timestamp ms
        .replace(/\d{10}/g, '') // Timestamp s
        .replace(/\s+/g, ' ')
        .trim();

    const enc = new TextEncoder();
    const data = enc.encode(cleaned);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

export class UrlWatchdog {
    /**
     * Run a check cycle for all eligible listeners
     */
    static async runCheckCycle(): Promise<CheckResult[]> {
        const results: CheckResult[] = [];

        try {
            // 1. Scan for all listeners
            // Note: In a massive scale system, we would shard this. 
            // For now, scan is acceptable for < 10k listeners.
            let cursor: number | string = 0;
            const listenerKeys: string[] = [];

            do {
                const scan = await redis.scan(cursor, { match: 'listener:*', count: 100 });
                cursor = scan[0];
                listenerKeys.push(...scan[1]);
            } while (cursor !== 0);

            // 2. Process each listener
            for (const key of listenerKeys) {
                try {
                    const listener = await redis.hgetall(key) as unknown as Listener;

                    // Validate listener data
                    if (!listener || !listener.url || !listener.checkInterval) continue;

                    // Check if it's time to run
                    const now = Date.now();
                    const lastCheck = parseInt((listener.lastCheck || '0').toString());
                    const interval = parseInt((listener.checkInterval || '0').toString());

                    if (now - lastCheck < interval) {
                        continue; // Too soon
                    }

                    // 3. Fetch and Hash
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                    const res = await fetch(listener.url, {
                        signal: controller.signal,
                        headers: { 'User-Agent': 'AgentCache-Watchdog/1.0' }
                    });
                    clearTimeout(timeoutId);

                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }

                    const content = await res.text();
                    const newHash = await hashContent(content);

                    // 4. Compare
                    if (newHash !== listener.lastHash) {
                        results.push({
                            listenerId: key.split(':')[2], // Extract ID from key
                            url: listener.url,
                            changed: true,
                            oldHash: listener.lastHash,
                            newHash
                        });

                        // 5. Update Listener State
                        await redis.hset(key, {
                            lastCheck: now,
                            lastHash: newHash
                        });

                        // 6. Trigger Actions (Invalidation / Webhook)
                        if (listener.invalidateOnChange) {
                            await UrlWatchdog.invalidateCache(listener.namespace, listener.url);
                        }

                        if (listener.webhook) {
                            await UrlWatchdog.triggerWebhook(listener.webhook, {
                                event: 'content_changed',
                                url: listener.url,
                                namespace: listener.namespace,
                                timestamp: now
                            });
                        }
                    } else {
                        // No change, just update timestamp
                        await redis.hset(key, { lastCheck: now });
                        results.push({
                            listenerId: key.split(':')[2],
                            url: listener.url,
                            changed: false,
                            oldHash: listener.lastHash,
                            newHash
                        });
                    }

                } catch (err: any) {
                    console.error(`Failed to check ${key}:`, err);
                    results.push({
                        listenerId: key.split(':')[2],
                        url: 'unknown',
                        changed: false,
                        oldHash: '',
                        newHash: '',
                        error: err.message
                    });
                }
            }
        } catch (err) {
            console.error('Watchdog cycle failed:', err);
        }

        return results;
    }

    private static async invalidateCache(namespace: string, url: string) {
        // Call the internal invalidation logic (or reuse the API handler logic)
        // For modularity, we should ideally extract the invalidation logic to a library too.
        // For now, we'll simulate the effect by deleting keys matching the pattern.

        // Pattern: agentcache:v1:{namespace}:*
        // We need to find keys where metadata sourceUrl == url
        // This is expensive without a reverse index. 
        // Optimization: Just invalidate the namespace for now.

        const scanPattern = `agentcache:v1:${namespace}:*`;
        let cursor: number | string = 0;
        const keysToDelete: string[] = [];

        do {
            const scan = await redis.scan(cursor, { match: scanPattern, count: 100 });
            cursor = scan[0];
            keysToDelete.push(...scan[1]);
        } while (cursor !== 0);

        if (keysToDelete.length > 0) {
            const pipeline = redis.pipeline();
            keysToDelete.forEach(key => {
                pipeline.del(key);
                pipeline.del(`${key}:meta`);
            });
            await pipeline.exec();
            console.log(`[Watchdog] Invalidated ${keysToDelete.length} keys in namespace ${namespace}`);
        }
    }

    private static async triggerWebhook(webhookUrl: string, payload: any) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error(`[Watchdog] Webhook failed for ${webhookUrl}`, err);
        }
    }
}
