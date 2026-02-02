import 'dotenv/config';
import { Redis } from 'ioredis';

// Initialize Redis
const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

async function seed() {
    console.log('🌱 Seeding Mission Control Data...');

    // 1. Defense Log (Security)
    const securityEvents = [
        { type: 'PROMPT_INJECTION', source: '203.0.113.45', severity: 'HIGH', details: 'Simulated jailbreak attempt', timestamp: Date.now() - 1000 * 60 * 15 },
        { type: 'RATE_LIMIT', source: '198.51.100.2', severity: 'MEDIUM', details: 'Exceeded 100 req/min', timestamp: Date.now() - 1000 * 60 * 60 * 2 },
        { type: 'SQL_INJECTION', source: '192.0.2.1', severity: 'CRITICAL', details: 'Blocked by WAF', timestamp: Date.now() - 1000 * 60 * 60 * 5 },
        { type: 'AUTH_FAILURE', source: 'admin-login', severity: 'LOW', details: 'Invalid password', timestamp: Date.now() - 1000 * 60 * 60 * 12 },
        { type: 'SCANNER', source: '45.33.22.11', severity: 'MEDIUM', details: 'Port 443 sweep', timestamp: Date.now() - 1000 * 60 * 60 * 24 },
    ];
    await redis.del('defense:log');
    for (const event of securityEvents) {
        await redis.rpush('defense:log', JSON.stringify(event));
    }
    console.log(`✅ Seeded ${securityEvents.length} Security Events`);

    // 2. Truth Log (Verification)
    const truthClaims = [
        { claim: 'The earth is flat', verdict: 'FALSE', confidence: 0.99, sources: ['NASA', 'Physics'], timestamp: Date.now() - 1000 * 60 * 30 },
        { claim: 'Solana is a blockchain', verdict: 'TRUE', confidence: 0.98, sources: ['Whitepaper'], timestamp: Date.now() - 1000 * 60 * 60 },
        { claim: 'AI Agents can feel pain', verdict: 'FALSE', confidence: 0.95, sources: ['Neurology', 'CS'], timestamp: Date.now() - 1000 * 60 * 120 },
    ];
    await redis.del('truth:log');
    for (const claim of truthClaims) {
        await redis.rpush('truth:log', JSON.stringify(claim));
    }
    console.log(`✅ Seeded ${truthClaims.length} Truth Claims`);

    // 3. Treasury Log (Transactions)
    const transactions = [
        { id: 'tx_1', type: 'stripe_in', amount: 29.00, desc: 'Pro Subscription', time: Date.now() - 100000 },
        { id: 'tx_2', type: 'sol_out', amount: -0.05, desc: 'Agent Gas Fee', time: Date.now() - 500000 },
        { id: 'tx_3', type: 'stripe_usage', amount: 12.50, desc: 'API Credits', time: Date.now() - 2000000 },
        { id: 'tx_4', type: 'sol_in', amount: 0.10, desc: 'Service Fee', time: Date.now() - 3600000 },
    ];
    await redis.del('treasury:log');
    for (const tx of transactions) {
        await redis.rpush('treasury:log', JSON.stringify(tx));
    }
    console.log(`✅ Seeded ${transactions.length} Treasury Transactions`);

    // 4. Cortex Active Nodes
    const nodes = [
        { id: 'mem_1', type: 'concept', label: 'Rust Lang', weight: 0.98 },
        { id: 'mem_2', type: 'entity', label: 'Solana', weight: 0.85 },
        { id: 'mem_3', type: 'pattern', label: 'Auth Flow', weight: 0.72 },
        { id: 'mem_4', type: 'concept', label: 'Agentic UI', weight: 0.65 },
        { id: 'mem_5', type: 'entity', label: 'Stripe', weight: 0.60 }
    ];
    await redis.del('cortex:active_nodes');
    for (const node of nodes) {
        await redis.rpush('cortex:active_nodes', JSON.stringify(node));
    }
    console.log(`✅ Seeded ${nodes.length} Cortex Nodes`);

    redis.disconnect();
}

seed().catch(console.error);
