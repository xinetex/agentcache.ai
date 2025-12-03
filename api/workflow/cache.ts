import { db } from '../../src/db/client';
import { knowledgeNodes } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Helper to generate a deterministic key for a goal+context
        const generateKey = (goal: string, context: any) => {
            const contextStr = JSON.stringify(context || {});
            const hash = crypto.createHash('sha256').update(`${goal}:${contextStr}`).digest('hex');
            return `workflow:plan:${hash}`;
        };

        if (req.method === 'POST') {
            const { goal, context, plan } = req.body;

            if (!goal || !plan) {
                return res.status(400).json({ error: 'Missing goal or plan' });
            }

            const key = generateKey(goal, context);

            // Store in knowledge nodes
            await db.insert(knowledgeNodes).values({
                key,
                value: { goal, context, plan, createdAt: new Date().toISOString() },
                confidence: 1.0,
                authorAgentId: 'system:planner',
            }).onConflictDoUpdate({
                target: knowledgeNodes.key,
                set: {
                    value: { goal, context, plan, updatedAt: new Date().toISOString() },
                    confidence: 1.0,
                }
            });

            return res.status(200).json({ success: true, key });
        }

        if (req.method === 'GET') {
            const { goal, context } = req.query;

            if (!goal) {
                return res.status(400).json({ error: 'Missing goal' });
            }

            // Parse context from query if it's a string, otherwise use empty object
            let parsedContext = {};
            try {
                parsedContext = context ? JSON.parse(context as string) : {};
            } catch (e) {
                // Ignore parse error, use empty
            }

            const key = generateKey(goal as string, parsedContext);
            const nodes = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.key, key));

            if (nodes.length === 0) {
                return res.status(404).json({ error: 'Plan not found' });
            }

            return res.status(200).json({ plan: (nodes[0].value as any).plan });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Workflow Cache API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
