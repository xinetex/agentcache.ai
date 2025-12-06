import { withAuth } from '../lib/auth-unified.js';
import { generateEmbedding } from '../src/lib/llm/embeddings.js';
import { redis } from '../src/lib/redis.js';
import { createHash } from 'crypto';

import { CountMinSketch } from '../src/lib/structs/sketch.js';

// Global Sketch (Persists across warm lambda invocations)
// This acts as a "Doorkeeper" to prevent one-hit wonders from polluting the Redis cache.
const sketch = new CountMinSketch(256, 4);

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
            // Update Frequency on Hit (TinyLFU Logic: Keep popular items popular)
            sketch.add(hash);

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

        // 3. Admission Policy (TinyLFU / Sketch)
        sketch.add(hash);
        const frequency = sketch.estimate(hash);

        // "Frequency Gate": Only cache if seen at least twice (or if lambda is hot and it's popular)
        // For the first miss (freq=1), we skip caching (or cache with very short TTL).
        // For the second miss (freq=2), we admit to main cache.

        if (frequency >= 2) {
            await redis.setex(cacheKey, 2592000, JSON.stringify(embedding)); // 30 Days
        } else {
            // Probationary Cache: 1 hour only (to handle bursty repeats on different lambdas)
            // This gives it a chance to become popular.
            await redis.setex(cacheKey, 3600, JSON.stringify(embedding));
        }

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
