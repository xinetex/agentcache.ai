import { db } from '../../src/db/client';
import { decisions } from '../../src/db/schema';
import { desc } from 'drizzle-orm';

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
            const { limit = '50', offset = '0' } = req.query;

            const recentDecisions = await db.select()
                .from(decisions)
                .orderBy(desc(decisions.timestamp))
                .limit(parseInt(limit as string))
                .offset(parseInt(offset as string));

            return res.status(200).json({ decisions: recentDecisions });
        }

        if (req.method === 'POST') {
            const { agentId, action, reasoning, outcome } = req.body;

            if (!action) {
                return res.status(400).json({ error: 'Missing action' });
            }

            const result = await db.insert(decisions).values({
                agentId,
                action,
                reasoning,
                outcome,
                timestamp: new Date(),
            }).returning();

            return res.status(200).json({ decision: result[0] });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Decisions API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
