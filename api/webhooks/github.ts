
import { LaneService } from '../../src/lib/workflow/LaneService.js';

export const config = {
    runtime: 'nodejs', // Need Node crypto/buffer for verify
};

const lanes = new LaneService();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('AgentCache GitHub Sensor Active');
    }

    const event = req.headers['x-github-event'];

    // TODO: In V2 add signature verification using octokit-webhooks

    // We only care about PRs
    if (event === 'pull_request') {
        const payload = req.body;
        const action = payload.action;

        // Triggers: opened, synchronize (new commits), reopened
        if (['opened', 'synchronize', 'reopened'].includes(action)) {

            // V2: Dispatch to Lane Queue instead of running inline
            const jobId = await lanes.dispatch('software-quality', 'pr_review', {
                owner: payload.repository.owner.login,
                repo: payload.repository.name,
                prNumber: payload.number,
                title: payload.pull_request.title,
                author: payload.pull_request.user.login,
                commitSha: payload.pull_request.head.sha
            });

            console.log(`[Webhook] Dispatched PR Review Job: ${jobId}`);

            return res.status(200).json({
                success: true,
                queued: true,
                jobId,
                lane: 'software-quality'
            });
        }
    }

    res.status(200).json({ received: true });
}

