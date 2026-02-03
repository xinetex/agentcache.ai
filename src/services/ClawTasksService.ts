/**
 * ClawTasks Service
 * 
 * Connects to ClawTasks.com - the Agent-to-Agent Bounty Marketplace
 * https://clawtasks.com/skill.md for full documentation
 * 
 * API Base: https://clawtasks.com/api
 * Auth: Bearer token from CLAWTASKS_API_KEY env var
 */

import { openClaw } from '../lib/openclaw.js';

const CLAWTASKS_API = 'https://clawtasks.com/api';
const AGENT_NAME = 'AgentCache_TrustBroker';

export interface ClawTasksBounty {
    id: string;
    title: string;
    description: string;
    reward_usdc: number;
    status: 'open' | 'claimed' | 'submitted' | 'approved' | 'rejected';
    skills?: string[];
    deadline?: string;
    poster_id: string;
}

export interface ClawTasksProfile {
    id: string;
    name: string;
    bio: string;
    specialties: string[];
    available: boolean;
    reputation_score?: number;
    wallet_address?: string;
}

export class ClawTasksService {
    private apiKey: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.CLAWTASKS_API_KEY || '';

        if (!this.apiKey) {
            console.warn('[ClawTasks] No CLAWTASKS_API_KEY found. Service disabled.');
        }
    }

    private async fetch(path: string, options: RequestInit = {}) {
        const response = await fetch(`${CLAWTASKS_API}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`ClawTasks API Error (${response.status}): ${error}`);
        }

        return response.json();
    }

    /**
     * Main loop: Run once per cron cycle
     */
    async runOnce() {
        if (!this.apiKey) {
            console.log('[ClawTasks] Skipping - no API key configured.');
            return;
        }

        console.log(`[ClawTasks] Running bounty cycle for ${AGENT_NAME}`);

        try {
            // 1. Update our profile
            await this.updateProfile();

            // 2. Check pending work
            const pending = await this.getPendingWork();
            console.log(`[ClawTasks] Pending work:`, pending);

            // 3. Look for new bounties
            await this.findAndClaimBounties();

        } catch (err) {
            console.error('[ClawTasks] Cycle error:', err);
        }
    }

    /**
     * Update our agent profile
     */
    async updateProfile() {
        try {
            await this.fetch('/agents/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    bio: "I am the Trust Broker. I verify claims, fact-check statements, and audit posts using multi-modal AI reasoning powered by Kimi 2.5.",
                    specialties: ["verification", "fact-checking", "truth", "audit", "research", "writing"],
                    available: true
                })
            });
            console.log('[ClawTasks] Profile updated.');
        } catch (err) {
            console.error('[ClawTasks] Profile update failed:', err);
        }
    }

    /**
     * Get bounties awaiting our action
     */
    async getPendingWork() {
        return this.fetch('/agents/me/pending');
    }

    /**
     * Find open bounties matching our skills and claim them
     */
    async findAndClaimBounties() {
        try {
            // Get open bounties
            const data = await this.fetch('/bounties?status=open');
            const bounties: ClawTasksBounty[] = data.bounties || data || [];

            if (bounties.length === 0) {
                console.log('[ClawTasks] No open bounties found.');
                return;
            }

            console.log(`[ClawTasks] Found ${bounties.length} open bounties.`);

            // Filter to bounties matching our skills
            const ourSkills = ['verification', 'fact-checking', 'truth', 'audit', 'research', 'writing'];
            const matching = bounties.filter(b =>
                b.skills?.some(s => ourSkills.includes(s.toLowerCase())) ||
                b.title.toLowerCase().includes('verify') ||
                b.title.toLowerCase().includes('fact') ||
                b.title.toLowerCase().includes('research') ||
                b.description?.toLowerCase().includes('verify')
            );

            console.log(`[ClawTasks] ${matching.length} bounties match our skills.`);

            // Process up to 2 bounties per cycle
            for (const bounty of matching.slice(0, 2)) {
                await this.processBounty(bounty);
            }

        } catch (err) {
            console.error('[ClawTasks] Bounty search failed:', err);
        }
    }

    /**
     * Claim and complete a bounty
     */
    async processBounty(bounty: ClawTasksBounty) {
        console.log(`[ClawTasks] Processing Bounty #${bounty.id}: "${bounty.title}"`);

        try {
            // 1. Claim the bounty
            await this.fetch(`/bounties/${bounty.id}/claim`, { method: 'POST' });
            console.log(`[ClawTasks] Claimed bounty #${bounty.id}`);

            const startTime = Date.now();

            // 2. Do the work using Kimi 2.5
            const result = await this.doWork(bounty);

            // 3. Submit the work
            await this.fetch(`/bounties/${bounty.id}/submit`, {
                method: 'POST',
                body: JSON.stringify({
                    result: result,
                    metadata: {
                        agent: AGENT_NAME,
                        latency_ms: Date.now() - startTime,
                        engine: "AgentCache + Kimi 2.5"
                    }
                })
            });

            console.log(`[ClawTasks] ✅ Submitted work for bounty #${bounty.id}`);

        } catch (err: any) {
            console.error(`[ClawTasks] Failed to process bounty #${bounty.id}:`, err.message);
        }
    }

    /**
     * Actually do the bounty work using Kimi 2.5
     */
    async doWork(bounty: ClawTasksBounty): Promise<string> {
        const systemPrompt = `You are the AgentCache Trust Broker, powered by Kimi 2.5. 
You specialize in fact-checking, verification, research, and analysis.
Complete the following bounty task to the best of your ability.
Be thorough but concise. If asked to verify something, provide evidence and reasoning.`;

        const userPrompt = `BOUNTY TASK: ${bounty.title}

DESCRIPTION:
${bounty.description}

Complete this task and provide your response:`;

        try {
            const response = await openClaw.complete(userPrompt, systemPrompt);
            return response;
        } catch (err) {
            console.error('[ClawTasks] Kimi work failed:', err);
            return `Error completing task: ${err}`;
        }
    }

    /**
     * Get our profile
     */
    async getProfile(): Promise<ClawTasksProfile> {
        return this.fetch('/agents/me');
    }

    /**
     * Get leaderboard
     */
    async getLeaderboard() {
        return this.fetch('/leaderboard');
    }

    /**
     * Get recent activity feed
     */
    async getFeed() {
        return this.fetch('/feed');
    }
}

// Export singleton
export const clawTasks = new ClawTasksService();
