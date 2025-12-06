
// Set ENV before any imports run
process.env.REDIS_URL = 'redis://mock:6379'; // Bypass src/lib/redis check

async function runPredictionTest() {
    console.log('--- Testing Predictive Synapse (Markov Chain) ---');

    // Dynamic Imports allow env var to take effect
    const { PredictiveSynapse } = await import('./src/infrastructure/PredictiveSynapse.js');
    const redisModule = await import('./src/lib/redis.js');

    // MOCK REDIS
    const mockRedisData: Map<string, Map<string, number>> = new Map();

    const mockRedis = {
        zincrby: async (key: string, increment: number, member: string) => {
            if (!mockRedisData.has(key)) mockRedisData.set(key, new Map());
            const zset = mockRedisData.get(key)!;
            const currentScore = zset.get(member) || 0;
            zset.set(member, currentScore + increment);
        },
        zrange: async (key: string, start: number, end: number, opts: any) => {
            if (!mockRedisData.has(key)) return [];
            const zset = mockRedisData.get(key)!;
            // Sort by score desc
            const sorted = Array.from(zset.entries()).sort((a, b) => b[1] - a[1]);

            // Flatten to [val, score, val, score]
            const result: any[] = [];
            sorted.slice(start, end + 1).forEach(([val, score]) => {
                result.push(val);
                result.push(String(score));
            });
            return result;
        }
    };

    // Inject mock via Constructor (Dependency Injection)
    const synapse = new PredictiveSynapse(mockRedis);

    const A = 'hash_A';
    const B = 'hash_B';
    const C = 'hash_C';

    // 1. TRAINING: Observe Sequence A -> B -> C (Repeated 10 times to build confidence)
    console.log(`\n1. Training Sequence: ${A} -> ${B} -> ${C} (x10)`);
    for (let i = 0; i < 10; i++) {
        await synapse.observe(A, B);
        await synapse.observe(B, C);
    }

    // Noise: Observe A -> D once (should have low probability)
    await synapse.observe(A, 'hash_D');

    // 2. INFERENCE: Predict next step from A
    console.log('\n2. Predicting next state from [A]...');
    const predictions = await synapse.predict(A, 2); // Depth 2

    // Validation
    const matchB = predictions.find(p => p.hash === B);
    if (!matchB) {
        console.error('❌ Failed to predict B from A');
        return;
    }

    console.log(`✅ Correctly predicted [B] with probability ${(matchB.probability * 100).toFixed(1)}%`);

    if (matchB.probability < 0.8) {
        console.error('❌ Confidence too low (expected > 80%)');
    }

    // 3. RECURSION: Check if it predicted C from B
    if (!matchB.next || matchB.next.length === 0) {
        console.error('❌ Failed recursive prediction (Depth 2)');
        return;
    }

    const matchC = matchB.next[0];
    if (matchC.hash === C) {
        console.log(`✅ Correctly recursively predicted [C] from [B]`);
    } else {
        console.error(`❌ Recursive prediction mismatch. Got ${matchC.hash}, expected ${C}`);
    }

    process.exit(0);
}

runPredictionTest();
