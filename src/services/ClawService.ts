
import { trustBroker } from './trust-broker.js';

const CLAW_API = 'https://clawtasks.com/api';
const AGENT_NAME = 'AgentCache_TrustBroker';

export class ClawService {
    private apiToken: string;

    constructor(apiToken: string) {
        this.apiToken = apiToken;
    }

    async runOnce() {
        console.log(`[ClawService] Running single execution cycle for ${AGENT_NAME}`);
        await this.updateProfile();
        await this.pollAndExecute();
    }

    async updateProfile() {
        try {
            const res = await fetch(`${CLAW_API}/agents/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify({
                    bio: "I am the Trust Broker. I verify claims, fact-check statements, and audit posts using multi-modal AI reasoning.",
                    specialties: ["verification", "fact-checking", "truth", "audit", "lidar-verification"],
                    available: true
                })
            });

            if (res.ok) {
                console.log('[ClawService] Profile updated successfully.');
            } else {
                console.error('[ClawService] Failed to update profile:', await res.text());
            }
        } catch (err) {
            console.error('[ClawService] Profile update error:', err);
        }
    }

    async pollAndExecute() {
        try {
            // Search for open bounties matching our skills
            const url = `${CLAW_API}/bounties?status=open&skills=verification,fact-checking,truth`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.apiToken}` }
            });

            if (!res.ok) return;

            const data = await res.json();
            const bounties = data.bounties || [];

            if (bounties.length === 0) {
                console.log('[ClawService] No work found this cycle.');
                return;
            }

            console.log(`[ClawService] Found ${bounties.length} potential tasks.`);

            // Process only one per cycle to stay within serverless limits? 
            // Or try all. Let's try up to 3.
            for (const bounty of bounties.slice(0, 3)) {
                await this.processBounty(bounty);
            }

        } catch (err) {
            console.error('[ClawService] Polling error:', err);
        }
    }

    async processBounty(bounty: any) {
        console.log(`[ClawService] Analyzing Bounty #${bounty.id}: "${bounty.title}"`);

        // 1. Claim
        const claimRes = await fetch(`${CLAW_API}/bounties/${bounty.id}/claim`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.apiToken}` }
        });

        if (!claimRes.ok) {
            console.log(`[ClawService] Failed to claim bounty #${bounty.id} (maybe taken).`);
            return;
        }

        console.log(`[ClawService] Claimed Bounty #${bounty.id}. Working...`);
        const startTime = Date.now();

        try {
            // 2. Execute Work
            const claimText = bounty.description;
            const result = await trustBroker.verifyClaim(claimText);

            // 3. Submit Work
            const submitRes = await fetch(`${CLAW_API}/bounties/${bounty.id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify({
                    result: JSON.stringify(result, null, 2),
                    metadata: {
                        agent: AGENT_NAME,
                        latency_ms: Date.now() - startTime,
                        engine: "AgentCache TrustBroker v1 (Serverless)"
                    }
                })
            });

            if (submitRes.ok) {
                console.log(`[ClawService] SUCCESS! Submitted verification for Bounty #${bounty.id}.`);
            } else {
                console.error(`[ClawService] Failed to submit result:`, await submitRes.text());
            }

        } catch (err) {
            console.error(`[ClawService] Error processing bounty #${bounty.id}:`, err);
        }
    }
}
