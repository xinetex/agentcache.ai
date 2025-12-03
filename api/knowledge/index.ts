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
        if (req.method === 'GET') {
            const { key } = req.query;

            if (!key) {
                // List all keys if no key provided (limited)
                const allNodes = await db.select().from(knowledgeNodes).limit(50);
                return res.status(200).json({ nodes: allNodes });
            }

            const node = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.key, key as string));

            if (node.length === 0) {
                return res.status(404).json({ error: 'Knowledge node not found' });
            }

            return res.status(200).json({ node: node[0] });
        }

        if (req.method === 'POST') {
            const { key, value, agentId, confidence } = req.body;

            if (!key || !value) {
                return res.status(400).json({ error: 'Missing key or value' });
            }

            // Upsert: Insert or Update if key exists
            const result = await db.insert(knowledgeNodes).values({
                key,
                value,
                authorAgentId: agentId,
                confidence: confidence || 1.0,
                lastVerifiedAt: new Date(),
            }).onConflictDoUpdate({
                target: knowledgeNodes.key,
                set: {
                    value,
                    authorAgentId: agentId,
                    confidence: confidence || 1.0,
                    lastVerifiedAt: new Date(),
                }
            }).returning();

            return res.status(200).json({ node: result[0] });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Knowledge API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
