
import { db } from '../../src/db/client.js';
import { agents, agentRegistry, users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    const { method } = req;
    const userId = req.headers.get('x-user-id');

    if (!userId) return new Response('Unauthorized', { status: 401 });

    try {
        // Enforce Admin Role
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user || user.role !== 'admin') {
            return new Response('Forbidden: Admin Access Only', { status: 403 });
        }

        if (method === 'GET') {
            // Join Agents with AgentRegistry
            // Note: Drizzle's query builder for joins is powerful but we'll use a raw-ish query or separate queries if join is complex
            // Simple approach: Get all agents, then get all registry entries, merge in code

            const allAgents = await db.select().from(agents);
            const registryEntries = await db.select().from(agentRegistry);

            // Map registry by agentId
            const registryMap = registryEntries.reduce((acc, curr) => {
                acc[curr.agentId] = curr;
                return acc;
            }, {});

            const fleet = allAgents.map(agent => ({
                ...agent,
                control: registryMap[agent.id] || { isEnabled: false, status: 'unregistered' }
            }));

            return new Response(JSON.stringify({ fleet }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (method === 'POST') {
            const body = await req.json();
            const { agentId, isEnabled, schedule, budgetLimit } = body;

            if (!agentId) return new Response('Missing agentId', { status: 400 });

            // Upsert Registry Entry
            await db.insert(agentRegistry)
                .values({
                    agentId,
                    isEnabled,
                    schedule,
                    budgetLimit,
                    updatedAt: new Date()
                })
                .onConflictDoUpdate({
                    target: agentRegistry.agentId, // IMPORTANT: Ensure schema has unique constraint on agentId or primary key usage
                    // Actually, schema definition has id as primary key, but agentId should be unique effectively 1:1
                    // Let's create a partial index or just assume we query by agentId first?
                    // Better: modify schema to make agentId unique or use it as PK? 
                    // Current Schema: id is PK, agentId is FK. We didn't set unique on agentId in schema.js yet.
                    // Workaround: We must find the ID first if it exists.

                    // Since we can't easily change schema in this step without migration, let's do a Check-then-Update approach.
                });

            // Check if exists
            const [existing] = await db.select().from(agentRegistry).where(eq(agentRegistry.agentId, agentId)).limit(1);

            let result;
            if (existing) {
                [result] = await db.update(agentRegistry)
                    .set({
                        isEnabled: isEnabled !== undefined ? isEnabled : existing.isEnabled,
                        schedule: schedule !== undefined ? schedule : existing.schedule,
                        budgetLimit: budgetLimit !== undefined ? budgetLimit : existing.budgetLimit,
                        updatedAt: new Date()
                    })
                    .where(eq(agentRegistry.id, existing.id)) // Use PK for update
                    .returning();
            } else {
                [result] = await db.insert(agentRegistry)
                    .values({
                        agentId,
                        isEnabled: isEnabled || false,
                        schedule,
                        budgetLimit: budgetLimit || 0
                    })
                    .returning();
            }

            return new Response(JSON.stringify({ success: true, config: result }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        console.error("[Fleet Control API] Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
