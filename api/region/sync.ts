import { replicator } from '../../src/lib/replicator';

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
        if (req.method === 'POST') {
            const { key, targetRegion } = req.body;

            if (!key || !targetRegion) {
                return res.status(400).json({ error: 'Missing key or targetRegion' });
            }

            const result = await replicator.replicate(key, targetRegion);
            return res.status(200).json(result);
        }

        if (req.method === 'GET') {
            const { key } = req.query;

            if (!key) {
                return res.status(400).json({ error: 'Missing key' });
            }

            const locations = await replicator.getLocations(key as string);
            return res.status(200).json({ key, locations });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Region Sync API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
