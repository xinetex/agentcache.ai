import { Hono } from 'hono';
import { db } from '../db/client.js';
import { agents, knowledgeNodes, decisions } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

const app = new Hono();

app.get('/', async (c) => {
    try {
        // Fetch all active agents
        const allAgents = await db.select().from(agents);

        // Fetch recent knowledge nodes (limit to keep graph manageable)
        const nodes = await db.select().from(knowledgeNodes).limit(100);

        // Fetch recent activity for visualization effects
        const activity = await db.select()
            .from(decisions)
            .orderBy(desc(decisions.timestamp))
            .limit(20);

        // Build Graph Structure
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
