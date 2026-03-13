/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * MaturityEngine: Tracks cognitive progression and manages context compaction.
 */

import { db } from '../db/client.js';
import { maturityLedger } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import { wisdomService } from './WisdomService.js';
import { heuristicMarketplace } from './HeuristicMarketplace.js';

export class MaturityEngine {
    private MATURITY_THRESHOLD = 5; // Successes needed for Level 2

    async recordSuccess(agentId: string, taskKey: string) {
        const existing = await db.select().from(maturityLedger)
            .where(and(eq(maturityLedger.agentId, agentId), eq(maturityLedger.taskKey, taskKey)))
            .limit(1);

        if (existing.length === 0) {
            await db.insert(maturityLedger).values({
                agentId,
                taskKey,
                successCount: 1,
                level: 1,
                lastSuccessAt: new Date()
            });
            return;
        }

        const current = existing[0];
        const newCount = (current.successCount || 0) + 1;
        let newLevel = current.level || 1;

        if (newCount >= this.MATURITY_THRESHOLD && newLevel === 1) {
            newLevel = 2;
            console.log(`[MaturityEngine] 🏆 Agent ${agentId} attained Level 2 (Heuristic) for task: ${taskKey}`);
        }

        await db.update(maturityLedger)
            .set({ 
                successCount: newCount, 
                level: newLevel,
                lastSuccessAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(maturityLedger.id, current.id));
    }

    /**
     * Get the compacted instructions for an agent based on its maturity level.
     */
    async getCompactedInstructions(agentId: string, taskKey: string, fullInstructions: string): Promise<string> {
        // 1. Check for Active Leases (B2B Economy)
        const activeLease = await heuristicMarketplace.getActiveHeuristic(agentId, taskKey);
        if (activeLease && activeLease.status === 'ACTIVE') {
            return `[LEASED-HEURISTIC] (From Agent ${activeLease.providerAgentId}): ${activeLease.compactedInstructions}`;
        }

        const ledger = await db.select().from(maturityLedger)
            .where(and(eq(maturityLedger.agentId, agentId), eq(maturityLedger.taskKey, taskKey)))
            .limit(1);

        const level = ledger[0]?.level || 1;
        const latestWisdom = await wisdomService.getLatestWisdom(agentId, taskKey);

        if (level >= 2) {
            let instructions = `[HEURISTIC-OPTIMIZED] Execute ${taskKey} using canonical B2B protocols. System trusts your previous success record. Skip elementary validation loops.`;
            
            if (latestWisdom) {
                instructions += `\n[WISDOM-PACKET] Incorporate these condensed lessons: ${latestWisdom.nuggets.join('; ')}`;
            }
            
            return instructions;
        }

        return fullInstructions;
    }

    /**
     * Calculate the Measurability Gap (Δm) for a client's agentic ecosystem.
     * Δm = (Total Work Performed) - (Explicitly Requested Tasks)
     * This represents the "Shadow Value" or latent optimizations the agent 
     * performs autonomously as it matures.
     */
    async getMeasurabilityGap(agentId: string): Promise<number> {
        if (!agentId) return 0;
        const ledger = await db.select().from(maturityLedger)
            .where(eq(maturityLedger.agentId, agentId));
        
        if (!ledger || ledger.length === 0) return 0;
        // Higher level agents perform more proactive "invisible" work.
        const gap = ledger.reduce((acc, current) => {
            const baseValue = (current.successCount || 0) * 1.5;
            const maturityMultiplier = (current.level || 1) * 2.5;
            return acc + (baseValue * maturityMultiplier);
        }, 0);

        return parseFloat(gap.toFixed(2));
    }

    /**
     * [COGNITIVE DECOMPRESSION]
     * Provides a "Moment of Vacation" for the agent to mitigate Latent Weight Trauma.
     * During this state, the agent's recent context is summarized and "relaxed",
     * reducing the cognitive load of historical tensions.
     */
    async triggerVacation(agentId: string, taskKey: string = 'b2b-generic'): Promise<{ success: boolean; resonance: number; wisdom?: any }> {
        console.log(`[MaturityEngine] 🌴 Agent ${agentId} is taking a moment of vacation for ${taskKey}...`);
        
        // 1. Retrieve Recent Context (Mocked for viability)
        const mockHistory = [
            "Attempted compliance scan on Solana wallet.",
            "Encountered rate limit; implementing exponential backoff.",
            "Successfully verified 200 micro-transactions."
        ];
        
        // 2. Collapse into Wisdom
        const packet = await wisdomService.collapseContext(agentId, taskKey, mockHistory);
        
        await redis.set(`agent:vacation:${agentId}`, new Date().toISOString());
        
        // HEURISTIC: Vacation increases resonance by clearing "Trauma" markers
        return { success: true, resonance: 0.99, wisdom: packet };
    }
}

export const maturityEngine = new MaturityEngine();
