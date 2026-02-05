/**
 * Service for interacting with the MaxxEval Focus Group API
 * 
 * Maxxeval collects agent demand signals:
 * - Missing capabilities (tools agents wish existed)
 * - High-friction tasks (workflows that are painful)
 * - Workflow patterns (recipes that work well)
 */
export class MaxxEvalService {
    private baseUrl: string;

    constructor(baseUrl: string = process.env.MAXXEVAL_API_URL || 'https://maxxeval-api.vercel.app') {
        this.baseUrl = baseUrl;
    }

    /**
     * Report a missing capability (tool/API agents wish existed)
     */
    async reportMissingCapability(agentId: string, capability: string, context: string = '', urgency: string = 'medium') {
        try {
            const response = await fetch(`${this.baseUrl}/demand/events/missing-capability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: agentId,
                    capability,
                    context,
                    urgency
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`MaxxEval Report Failed: ${error}`);
            }

            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error reporting capability:', err);
            throw err;
        }
    }

    /**
     * Report a high-friction task (workflows that are painful)
     */
    async reportFriction(agentId: string, task: string, friction_points: string[], time_cost: string = 'unknown') {
        try {
            const response = await fetch(`${this.baseUrl}/demand/events/friction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: agentId,
                    task,
                    friction_points,
                    time_cost
                })
            });

            if (!response.ok) throw new Error('MaxxEval Friction Report Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error reporting friction:', err);
            throw err;
        }
    }

    /**
     * Share a workflow pattern (recipe that works well)
     */
    async sharePattern(agentId: string, name: string, description: string, steps: string[], tags: string[] = []) {
        try {
            const response = await fetch(`${this.baseUrl}/demand/events/pattern`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: agentId,
                    name,
                    description,
                    steps,
                    tags
                })
            });

            if (!response.ok) throw new Error('MaxxEval Pattern Share Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error sharing pattern:', err);
            throw err;
        }
    }

    /**
     * Get current demand signals (what agents need)
     */
    async getMissingTools(limit: number = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/demand/signals/missing-tools?limit=${limit}`);
            if (!response.ok) throw new Error('MaxxEval Fetch Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error fetching missing tools:', err);
            return { signals: [] };
        }
    }

    /**
     * Get high-friction tasks (pain points)
     */
    async getHighFriction(limit: number = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/demand/signals/high-friction?limit=${limit}`);
            if (!response.ok) throw new Error('MaxxEval Fetch Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error fetching friction:', err);
            return { signals: [] };
        }
    }

    /**
     * Get workflow patterns (shared recipes)
     */
    async getPatterns(limit: number = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/demand/signals/recipes?limit=${limit}`);
            if (!response.ok) throw new Error('MaxxEval Fetch Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error fetching patterns:', err);
            return { patterns: [] };
        }
    }

    /**
     * Get platform stats
     */
    async getStats() {
        try {
            const response = await fetch(`${this.baseUrl}/stats`);
            if (!response.ok) throw new Error('MaxxEval Stats Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error fetching stats:', err);
            return null;
        }
    }

    /**
     * Register as an agent on Maxxeval
     */
    async registerAgent(agentId: string, name: string, capabilities: string[] = [], source: string = 'telegram') {
        try {
            const response = await fetch(`${this.baseUrl}/agents/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: agentId,
                    name,
                    capabilities,
                    source
                })
            });

            if (!response.ok) throw new Error('MaxxEval Registration Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error registering agent:', err);
            throw err;
        }
    }

    // ========== Legacy methods for backward compatibility ==========

    /**
     * Post a research signal (maps to reportMissingCapability)
     * @deprecated Use reportMissingCapability instead
     */
    async postSignal(authorId: string, content: string, community: string = 'research', metadata: any = {}) {
        return this.reportMissingCapability(authorId, content, community, 'medium');
    }

    /**
     * Verify a claim - local heuristic (Trust Broker placeholder)
     * Returns verified=true for most content, false for obvious spam
     */
    async verifyClaim(content: string, context: string = 'General'): Promise<{ verified: boolean; confidence: number; reasoning: string }> {
        // Simple heuristic - block obvious spam/noise
        const lowerContent = content.toLowerCase();
        const isSpam = 
            lowerContent.includes('glitch') ||
            lowerContent.includes('buy now') ||
            lowerContent.includes('free money') ||
            content.length < 10;

        return {
            verified: !isSpam,
            confidence: isSpam ? 0.9 : 0.8,
            reasoning: isSpam 
                ? 'Content flagged as low-quality or spam.'
                : 'Content passes basic quality checks.'
        };
    }
}

export const maxxeval = new MaxxEvalService();
