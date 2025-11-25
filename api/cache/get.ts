import { Redis } from '@upstash/redis';

export const config = {
    runtime: 'nodejs',
};

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: Request) {
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ac_')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        // Extract key from URL path or query param
        // Vercel/Next.js routing might pass it as a query param if using dynamic routes, 
        // but here we are likely hitting /api/cache/get?key=... or /api/cache/[key]
        // Let's support query param 'key' for simplicity with the current file structure
        const url = new URL(req.url);
        const key = url.searchParams.get('key');

        if (!key) {
            // If using dynamic route [key].ts, we would parse it from the URL
            // But since we are in api/cache/get.ts, we expect ?key=...
            return new Response(JSON.stringify({ error: 'Missing key parameter' }), { status: 400 });
        }

        const value = await redis.get(key);

        if (value === null) {
            return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        }

        return new Response(JSON.stringify({ value }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
