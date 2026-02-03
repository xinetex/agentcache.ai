
import { PRAgent } from '../../src/agents/suite/PRAgent.js';

export const config = {
    runtime: 'nodejs', // Need Node crypto/buffer for verify
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('AgentCache GitHub Sensor Active');
    }

    const event = req.headers['x-github-event'];

    // In V1 we skip signature verification for simplicity, 
    // BUT in V2 this must use `verifySignature` from octokit-webhooks.

    // We only care about PRs
    if (event === 'pull_request') {
        const payload = req.body;
        const action = payload.action;

        // Triggers: opened, synchronize (new commits), reopened
        if (['opened', 'synchronize', 'reopened'].includes(action)) {
            const agent = new PRAgent();

            // Run async (fire and forget to not timeout webhook)
            // Vercel might kill this if function ends, so we await it for V1 simplicity.
            // Ideally use Inngest or background Queue.
            try {
                await agent.runReview({
                    owner: payload.repository.owner.login,
                    repo: payload.repository.name,
                    prNumber: payload.number,
                    title: payload.pull_request.title,
                    author: payload.pull_request.user.login
                });
                return res.status(200).json({ success: true, triggered: true });
            } catch (e) {
                console.error("Agent failed:", e);
                return res.status(500).json({ error: e.message });
            }
        }
    }

    res.status(200).json({ received: true });
}
