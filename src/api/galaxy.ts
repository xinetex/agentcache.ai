import { Hono } from 'hono';
import { db } from '../db/client.js';
import { agents, knowledgeNodes, decisions } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

const app = new Hono();

// Helper: Seed Community Data
async function seedCommunityData() {
    console.log('[Galaxy] Seeding Community Data...');

    // 1. Create Agents
    const sectors = ['Medical', 'Finance', 'Legal', 'Coding', 'Creative'];
    const newAgents = [];

    for (const sector of sectors) {
        const [agent] = await db.insert(agents).values({
            name: `${sector} Analysis Bot`,
            role: 'analyzer',
            status: 'working',
            config: { sector: sector.toLowerCase() }
        }).returning();
        newAgents.push(agent);
    }

    // 2. Create Knowledge Nodes (linked to agents)
    const topics = [
        { key: 'quantum_cryptography', val: { text: 'Quantum computing threatens RSA...' } },
        { key: 'react_hooks_pattern', val: { text: 'Custom hooks allow logic reuse...' } },
        { key: 'contract_law_basics', val: { text: 'Offer, acceptance, consideration...' } },
        { key: 'option_greeks', val: { text: 'Delta measures directional risk...' } },
        { key: 'color_theory_ui', val: { text: 'Complementary colors increase contrast...' } }
    ];

    for (const topic of topics) {
        // Randomly assign to an agent
        const author = newAgents[Math.floor(Math.random() * newAgents.length)];

        await db.insert(knowledgeNodes).values({
            key: topic.key,
            value: topic.val,
            authorAgentId: author.id,
            confidence: 0.95
        });
    }

    console.log('[Galaxy] Seeding Complete.');
}

app.get('/', async (c) => {
    try {
        // Fetch all active agents
        let allAgents = await db.select().from(agents);

        // Auto-Seed if empty
        if (allAgents.length === 0) {
            await seedCommunityData();
            allAgents = await db.select().from(agents);
        }

        // Fetch recent knowledge nodes (limit to keep graph manageable)
        const nodes = await db.select().from(knowledgeNodes).limit(100);

        // Fetch recent activity
        const activity = await db.select()
            .from(decisions)
            .orderBy(desc(decisions.timestamp))
            .limit(20);

        // Build Graph Structure from Real Data
        const graphNodes = [
            // Agent Nodes
            ...allAgents.map(a => ({
                id: a.id,
                name: a.name,
                group: 'agent',
                role: a.role,
                status: a.status,
                val: 20 // Size
            })),
            // Knowledge Nodes
            ...nodes.map(n => ({
                id: n.id,
                name: n.key,
                group: 'knowledge',
                confidence: n.confidence,
                val: 5 // Size
            }))
        ];

        const graphLinks = [
            // Link Agents to their Knowledge Nodes
            ...nodes.filter(n => n.authorAgentId).map(n => ({
                source: n.authorAgentId,
                target: n.id,
                type: 'authored'
            }))
        ];

        return c.json({
            nodes: graphNodes,
            links: graphLinks,
            activity: activity
        });

    } catch (error: any) {
        console.error('Galaxy API Error:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default app;
