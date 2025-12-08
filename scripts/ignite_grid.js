
const Redis = require('ioredis');
require('dotenv').config({ path: '.env.local' });

// Config
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("Missing UPSTASH credentials in .env.local");
    process.exit(1);
}

// Helper for REST fallback if ioredis fails with URL
const fetch = require('node-fetch');

async function redisSet(key, value, ex) {
    const url = `${UPSTASH_URL}/set/${key}?ex=${ex}`;
    await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        body: typeof value === 'object' ? JSON.stringify(value) : value
    });
}

async function redisLPush(key, value) {
    const url = `${UPSTASH_URL}/lpush/${key}`;
    await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        body: typeof value === 'object' ? JSON.stringify(value) : value
    });
}

// Generators
const AGENTS = [
    { provider: 'openai', model: 'gpt-4-turbo' },
    { provider: 'anthropic', model: 'claude-3-opus' },
    { provider: 'anthropic', model: 'claude-3-sonnet' },
    { provider: 'mistral', model: 'mistral-large' },
    { provider: 'google', model: 'gemini-pro-1.5' }
];

const DISCOVERIES = [
    { type: 'tool', label: 'New Tool Integration', value: 'Stripe API v2', agent: 'BillingAgent' },
    { type: 'domain', label: 'New Knowledge Domain', value: 'Quantum Cryptography', agent: 'ResearchBot' },
    { type: 'pattern', label: 'Novel Query Pattern', value: 'Recursive Self-Correction', agent: 'GPT-4-Turbo' },
    { type: 'cache', label: 'High-Value Cache Key', value: 'User_Session_Global', agent: 'AuthSentinel' },
    { type: 'network', label: 'New Node Discovery', value: 'Cluster-Eu-West', agent: 'OpsMonitor' }
];

async function ignite() {
    console.log("🔥 Igniting the Living Grid...");

    // 1. Generate Traces (for Leaderboard & Metrics)
    console.log("-> Injecting 50 simulated traces...");
    for (let i = 0; i < 50; i++) {
        const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
        const isHit = Math.random() > 0.2;
        const trace = {
            id: `trace_${Date.now()}_${i}`,
            timestamp: new Date().toISOString(),
            provider: agent.provider,
            model: agent.model,
            latency: isHit ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 800) + 200,
            cacheHit: isHit,
            tokens: Math.floor(Math.random() * 500) + 100,
            cost: 0.002,
            error: Math.random() > 0.95
        };
        await redisLPush('traces:recent', JSON.stringify(trace));
    }

    // 2. Set Telemetry (Living Grid)
    console.log("-> Setting Earth Telemetry...");
    const telemetry = {
        timestamp: new Date().toISOString(),
        space: {
            station: 'ISS',
            status: 'tracking',
            latitude: 45.0,
            longitude: -75.0,
            altitude: 408,
            velocity: 27600
        },
        atmosphere: {
            location: 'US-East (Ashburn)',
            status: 'online',
            temp_c: 22.4,
            humidity: 45,
            wind_kph: 12
        }
    };
    await redisSet('telemetry:living_grid', JSON.stringify(telemetry), 60);

    console.log("✅ Ignition Complete! Dashboard should now be alive.");
}

ignite();
