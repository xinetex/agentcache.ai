import { Redis } from '@upstash/redis';

export const config = {
    runtime: 'nodejs',
};

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ac_')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const { key, value, ttl } = await req.json();

        if (!key || !value) {
            return new Response(JSON.stringify({ error: 'Missing key or value' }), { status: 400 });
        }

        // Store in Redis
        if (ttl) {
            await redis.set(key, value, { ex: ttl });
        } else {
            await redis.set(key, value);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
