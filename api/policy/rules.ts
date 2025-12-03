import { db } from '../../src/db/client';
import { knowledgeNodes } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { Policy } from '../../src/lib/policy-engine';

const GLOBAL_POLICIES_KEY = 'global_policies';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Helper to get current policies
        const getPolicies = async (): Promise<Policy[]> => {
            const node = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.key, GLOBAL_POLICIES_KEY));
            if (node.length === 0) return [];
            return (node[0].value as any).policies || [];
        };

        // Helper to save policies
        const savePolicies = async (policies: Policy[]) => {
            await db.insert(knowledgeNodes).values({
                key: GLOBAL_POLICIES_KEY,
                value: { policies, updatedAt: new Date().toISOString() },
                confidence: 1.0,
            }).onConflictDoUpdate({
                target: knowledgeNodes.key,
                set: {
                    value: { policies, updatedAt: new Date().toISOString() },
                    confidence: 1.0,
                }
            });
        };

        if (req.method === 'GET') {
            const policies = await getPolicies();
            return res.status(200).json({ policies });
        }

        if (req.method === 'POST') {
            const newPolicy: Policy = req.body;
            if (!newPolicy.id || !newPolicy.action) {
                return res.status(400).json({ error: 'Invalid policy format' });
            }

            const policies = await getPolicies();
            // Remove existing if same ID (update)
            const filtered = policies.filter(p => p.id !== newPolicy.id);
            filtered.push(newPolicy);

            await savePolicies(filtered);
            return res.status(200).json({ success: true, policy: newPolicy });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Missing policy ID' });

            const policies = await getPolicies();
            const filtered = policies.filter(p => p.id !== id);

            await savePolicies(filtered);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Policy API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
