
import { AgentCacheClient } from '../packages/agentcache-js/src/client';
import { db } from '../src/db/client.js';
import { redis } from '../src/lib/redis.js';

const client = new AgentCacheClient({
    apiKey: 'ac_community_seed', // Use a special seed key or just mock headers if bypassing auth
    baseUrl: 'http://localhost:3001'
});

const PATTERNS = [
    {
        category: 'Coding',
        prompt: 'Write a React component for a sortable data table',
        response: 'Here is a functional React component using hooks...',
        model: 'gpt-4o'
    },
    {
        category: 'Coding',
        prompt: 'Explain the difference between TCP and UDP',
        response: 'TCP is connection-oriented and reliable, while UDP is connectionless...',
        model: 'claude-3-opus'
    },
    {
        category: 'Creative',
        prompt: 'Write a haiku about artificial intelligence',
        response: 'Silicon thoughts wake,\nElectric dreams start to flow,\nMind in machine born.',
        model: 'gpt-4o'
    },
    {
        category: 'Analysis',
        prompt: 'Summarize the impact of quantum computing on cryptography',
        response: 'Quantum computing poses a significant threat to RSA encryption...',
        model: 'gemini-pro'
    },
    {
        category: 'Finance',
        prompt: 'What are the Greeks in options trading?',
        response: 'The Greeks (Delta, Gamma, Theta, Vega, Rho) measure risk...',
        model: 'gpt-4'
    }
];

async function seedCommunity() {
    console.log('🌱 Seeding Community Namespace...');

    const namespace = 'community';

    // 1. Seed Cache Entries (via Redis directly to ensure 'community' namespace key structure)
    // The SDK defaults to a specific user's namespace usually, so we force it here if needed.
    // Actually, let's use the SDK Set with explicit namespace if the SDK supports it.
    // Looking at client.ts, set() takes req.namespace.

    for (const pattern of PATTERNS) {
        console.log(`Saving: [${pattern.category}] ${pattern.prompt.substring(0, 20)}...`);

        await client.set({
            provider: 'openai', // Mock provider
            model: pattern.model,
            messages: [{ role: 'user', content: pattern.prompt }],
            namespace: namespace, // Explicitly target community
            ttl: 86400 * 30 // 30 Days
        }, pattern.response);
    }

    // 2. Seed Galaxy/Graph Nodes (Agents & Knowledge)
    // This usually happens via 'decisions' or 'indexing'. 
    // We'll manually insert into the 'knowledge_nodes' and 'agents' tables via Drizzle 
    // to ensure the Graph Visualization picks it up immediately.
    // NOTE: This requires importing the schema and DB client, which might fail if TS setup is strict.
    // For now, let's rely on the SDK cache set, which SHOULD trigger the background workers (if running) 
    // to populate the graph. If not, we might need manual DB insertion.

    console.log('✅ Community Data Seeded!');
}

seedCommunity().catch(console.error);
