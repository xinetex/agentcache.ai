
import { redis } from '../src/lib/redis.js';
import crypto from 'crypto';

/**
 * SWARM SIMULATION
 * Simulates an external "AutoGPT" swarm querying the Hive Mind.
 * It generates "Semantic Clusters" of requests.
 */

const CLUSTERS = [
    { label: 'Coding: React', templates: ['Generate a React Button', 'React Hook for fetching data', 'Next.js API Route example'] },
    { label: 'Coding: SQL', templates: ['SQL query for retention', 'Postgres migration example', 'Drizzle ORM select'] },
    { label: 'Creative: Poetry', templates: ['Haiku about rust', 'Sonnet about cybernetics', 'Free verse about entropy'] },
    { label: 'Fact: Science', templates: ['What is the speed of light?', 'Explain quantum entanglement', 'Define Mitochondria'] }
];

async function runSwarm() {
    console.log("🐝 SWARM: Awakening... Targeting Hive Mind.");

    // Simulate 50 requests
    for (let i = 0; i < 50; i++) {
        // Pick a random cluster
        const cluster = CLUSTERS[Math.floor(Math.random() * CLUSTERS.length)];
        // Pick a template
        const prompt = cluster.templates[Math.floor(Math.random() * cluster.templates.length)];

        // Variation
        const finalPrompt = `${prompt} [User ID: ${Math.floor(Math.random() * 1000)}]`;

        // Hash it to simulate "Semantic ID"
        const hash = crypto.createHash('sha256').update(cluster.label + prompt).digest('hex'); // Hash based on template not user variation to force clustering

        console.log(`🐝 DRONE ${i}: Requesting "${finalPrompt}"...`);

        // Log to Redis "Traffic Log" which PatternEngine monitors
        // Value: JSON { prompt, cluster: cluster.label, timestamp }
        await redis.lpush('traffic:inbox', JSON.stringify({
            prompt: finalPrompt,
            semantic_hash: hash,
            cluster_label: cluster.label,
            timestamp: Date.now()
        }));

        await new Promise(r => setTimeout(r, 100)); // Rate limit
    }

    console.log("🐝 SWARM: Mission Complete. 50 requests dispatched.");
    process.exit(0);
}

runSwarm();
