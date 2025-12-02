import { withAuth } from '../lib/auth-unified.js';
import { generateEmbedding } from '../src/lib/llm/embeddings.js';
import { redis } from '../src/lib/redis.js';
import { createHash } from 'crypto';

export const config = { runtime: 'nodejs' };

export default withAuth(async (req, auth) => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        const { text, model = 'text-embedding-3-small' } = await req.json();

        if (!text) {
            return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400 });
        }

        // 1. Check Cache
        // Key: SHA256(text + model)
        const hash = createHash('sha256')
            .update(text + model)
            .digest('hex');

        const cacheKey = `cache:embedding:${hash}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return new Response(JSON.stringify({
                embedding: JSON.parse(cached),
                cached: true,
                model
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. Generate Embedding (Miss)
        const embedding = await generateEmbedding(text);

        // 3. Store in Cache (TTL: 30 days)
        await redis.setex(cacheKey, 2592000, JSON.stringify(embedding));

        return new Response(JSON.stringify({
            embedding,
            cached: false,
            model
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Embedding API error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
