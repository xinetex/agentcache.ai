
import { LidarCacheService } from '../../src/services/LidarCacheService.js';

export default async function handler(req, res) {
    const { query } = req.body || req.query;

    if (!query) {
        return res.status(400).json({ error: 'Query is required.' });
    }

    const start = Date.now();
    let source = 'llm';
    let cost = 0.02; // Mock LLM cost
    let answer = '';

    // 1. Semantic Check
    // Threshold 0.1 allows for "very similar" queries to hit
    const cached = await LidarCacheService.getSemantic(query, 0.1);

    if (cached) {
        answer = cached;
        source = 'cache';
        cost = 0.00; // Free
    } else {
        // 2. Simulated LLM Call (Miss)
        // In real life: await LLM.chat(query)
        await new Promise(r => setTimeout(r, 1200)); // Simulate 1.2s latency

        answer = `Simulated LLM Answer for: "${query}". (Generated at ${new Date().toISOString()})`;

        // 3. Store for future
        await LidarCacheService.cacheSemantic(query, answer);
    }

    const latency = Date.now() - start;

    return res.status(200).json({
        answer,
        metadata: {
            source,
            latency_ms: latency,
            cost_usd: cost,
            saved: source === 'cache'
        }
    });
}
