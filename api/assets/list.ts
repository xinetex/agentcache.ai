
import { redis } from '../../src/lib/redis';
import { createHash } from 'crypto';

export const config = { runtime: 'nodejs' };

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
            },
        });
    }

    // Authenticate
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || !apiKey.startsWith('ac_')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Hash Key to get User ID/Storage Key
    const hash = createHash('sha256').update(apiKey).digest('hex');
    const storageKey = `files:${hash}`;

    try {
        // Fetch list from Redis (List of JSON strings)
        const rawFiles = await redis.lrange(storageKey, 0, -1);

        // Parse JSON
        const files = rawFiles.map(f => {
            try { return JSON.parse(f); } catch (e) { return null; }
        }).filter(Boolean);

        return new Response(JSON.stringify({ files }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
