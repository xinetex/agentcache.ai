import { db } from '../../src/db/client';
import { knowledgeNodes } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === 'POST') {
            const { mode, parameters, agentId } = req.body;

            if (!mode) {
                return res.status(400).json({ error: 'Missing mode' });
            }

            // Upsert the global governance mode
            const result = await db.insert(knowledgeNodes).values({
                key: 'global_governance_mode',
                value: { mode, parameters, updatedAt: new Date().toISOString() },
                authorAgentId: agentId || null, // Can be null if human (God) set it
                confidence: 1.0, // Absolute truth from God
                lastVerifiedAt: new Date(),
            }).onConflictDoUpdate({
                target: knowledgeNodes.key,
                set: {
                    value: { mode, parameters, updatedAt: new Date().toISOString() },
                    authorAgentId: agentId || null,
                    confidence: 1.0,
                    lastVerifiedAt: new Date(),
                }
            }).returning();

            return res.status(200).json({
                success: true,
                message: `Reality switched to ${mode}`,
                node: result[0]
            });
        }

        if (req.method === 'GET') {
            const node = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.key, 'global_governance_mode'));

            if (node.length === 0) {
                return res.status(200).json({ mode: 'Default', parameters: {} });
            }

            return res.status(200).json(node[0].value);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Governance API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
