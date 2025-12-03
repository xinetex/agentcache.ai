import 'dotenv/config';
import { eventBus } from '../src/lib/event-bus';
import { db } from '../src/db/client';
import { decisions, agents } from '../src/db/schema';
import { redis } from '../src/lib/redis';

async function simulate() {
    console.log("🚀 Starting Mission Control Simulation...");

    // 1. Create Mock Agent
    console.log("Creating mock agent...");
    const agentResult = await db.insert(agents).values({
        name: 'Sentinel-Prime',
        role: 'guardian',
        status: 'active'
    }).returning();
    const agentId = agentResult[0].id;

    // 2. Simulate Decisions
    console.log("Generating decisions...");
    const actions = ['REROUTE_TRAFFIC', 'SCALE_UP_POD', 'OPTIMIZE_CACHE', 'BLOCK_MALICIOUS_IP'];

    for (let i = 0; i < 5; i++) {
        await db.insert(decisions).values({
            agentId: agentId,
            action: actions[Math.floor(Math.random() * actions.length)],
            reasoning: `Detected anomaly in sector ${Math.floor(Math.random() * 9)}. Latency spike > 200ms. Initiating counter-measures.`,
            outcome: { status: 'success', latency_improved: `${Math.floor(Math.random() * 50)}ms` },
            timestamp: new Date()
        });
    }

    // 2. Simulate Events (via EventBus)
    console.log("Emitting events...");
    eventBus.publish({
        type: 'CACHE_HIT',
        agentId: 'Agent-Alpha',
        hash: 'a1b2c3d4',
        payload: { latency: 12 }
    });

    eventBus.publish({
        type: 'OPTIMIZATION',
        agentId: 'Swarm-Beta',
        hash: 'opt-x99',
        payload: { saved: '1.2MB' }
    });

    // 3. Simulate Stats (Redis)
    console.log("Updating stats...");
    await redis.incrby('stats:global:hits:d:' + new Date().toISOString().slice(0, 10), 50);
    await redis.incrby('stats:global:tokens:d:' + new Date().toISOString().slice(0, 10), 150000);

    console.log("✅ Simulation complete! Check the console.");
    process.exit(0);
}

simulate().catch(console.error);
