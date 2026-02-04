
import { moltbook } from '../../src/lib/moltbook.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { campaignId, content, title } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Missing content' });
    }

    try {
        console.log(`[Campaign] Deploying ${campaignId} to Moltbook...`);

        // Post to our community
        const result = await moltbook.post('agentcache-community', title || 'Research Signal', content);

        console.log(`[Campaign] Deployed successfully. ID: ${result.id}`);

        return res.status(200).json({
            success: true,
            postId: result.id,
            message: 'Campaign deployed to Moltbook network.'
        });
    } catch (error) {
        console.error('[Campaign] Deployment failed:', error);
        return res.status(500).json({ error: error.message || 'Deployment failed' });
    }
}
