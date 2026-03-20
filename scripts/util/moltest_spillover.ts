import 'dotenv/config';
console.log('[Debug] MOONSHOT_API_KEY present:', !!process.env.MOONSHOT_API_KEY);
console.log('[Debug] REDIS_URL present:', !!process.env.UPSTASH_REDIS_REST_URL);

import { moltAlphaService } from './src/services/MoltAlphaService.js';
import { redis } from './src/lib/redis.js';

async function test() {
    console.log('--- Molt-Alpha Spillover Audit ---');
    
    // 1. Manually trigger a prediction cycle
    console.log('Triggering prediction cycle...');
    const prediction = await moltAlphaService.predictNextViralTrend();
    console.log('Prediction:', prediction);

    // 2. Read back from Redis
    const magnitude = await redis.get('molt-alpha:last-magnitude');
    const velocity = await redis.get('molt-alpha:last-velocity');
    const stats = await moltAlphaService.getStats();

    console.log('Redis Magnitude:', magnitude);
    console.log('Redis Velocity:', velocity);
    console.log('Service Stats:', JSON.stringify(stats, null, 2));

    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
