
// Generate traffic to populate the dashboard

import { TraceService } from '../src/lib/observability/trace-service.js';

// Clean mocks for this script if needed, or just use the service directly which calls Redis
// This requires env vars for Redis.

const providers = ['openai', 'moonshot', 'anthropic'];
const models = ['gpt-4-turbo', 'moonshot-v1-8k', 'claude-3-opus'];

async function simulate() {
    console.log('🚀 Simulating Neural Traffic...');

    for (let i = 0; i < 10; i++) {
        const type = Math.random() > 0.7 ? 'hit' : (Math.random() > 0.9 ? 'error' : 'miss');
        const provider = providers[Math.floor(Math.random() * providers.length)];
        const model = models[Math.floor(Math.random() * models.length)];

        await TraceService.record({
            traceId: crypto.randomUUID(),
            type,
            userId: 'live_demo_hash',
            model,
            provider,
            latencyMs: Math.floor(Math.random() * 2000) + 20,
            tokens: { total: 100, prompt: 50, completion: 50 },
            cost: type === 'hit' ? 0 : 0.003
        });

        console.log(`Recorded ${type} for ${model}`);
        await new Promise(r => setTimeout(r, 500)); // Delay between requests
    }
    console.log('✅ Traffic Simulation Complete.');
}

simulate();
