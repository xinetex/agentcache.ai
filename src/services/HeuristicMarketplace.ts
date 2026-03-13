/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * HeuristicMarketplace: Manages the leasing of mature agent thinking patterns.
 * Phase 4: B2B Maturity Economy.
 */

import { redis } from '../lib/redis.js';

export interface HeuristicLease {
    id: string;
    providerAgentId: string;
    consumerClientId: string;
    taskKey: string;
    compactedInstructions: string;
    expiresAt: string;
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
    dailyFee: number;
}

export class HeuristicMarketplace {
    /**
     * Create a new lease for a mature heuristic.
     */
    async leaseHeuristic(
        providerAgentId: string, 
        consumerClientId: string, 
        taskKey: string,
        instructions: string
    ): Promise<HeuristicLease> {
        const id = `lease-${Math.random().toString(36).substring(7).toUpperCase()}`;
        const lease: HeuristicLease = {
            id,
            providerAgentId,
            consumerClientId,
            taskKey,
            compactedInstructions: instructions,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'ACTIVE',
            dailyFee: 25.00 // Standard daily rate for L3+ heuristics
        };

        console.log(`[HeuristicMarketplace] 💸 New lease ${id} created for ${taskKey} (Provider: ${providerAgentId})`);
        
        // Store the lease
        await redis.set(`b2b:lease:${id}`, JSON.stringify(lease));
        // Map client/task to active lease
        await redis.set(`b2b:active-lease:${consumerClientId}:${taskKey}`, id);
        
        return lease;
    }

    /**
     * Get the active heuristic for a client/task pair.
     */
    async getActiveHeuristic(clientId: string, taskKey: string): Promise<HeuristicLease | null> {
        const leaseId = await redis.get(`b2b:active-lease:${clientId}:${taskKey}`);
        if (!leaseId) return null;
        
        const leaseData = await redis.get(`b2b:lease:${leaseId}`);
        return leaseData ? JSON.parse(leaseData) : null;
    }

    /**
     * Terminate a lease.
     */
    async terminateLease(leaseId: string): Promise<boolean> {
        const leaseData = await redis.get(`b2b:lease:${leaseId}`);
        if (!leaseData) return false;
        
        const lease: HeuristicLease = JSON.parse(leaseData);
        lease.status = 'REVOKED';
        
        await redis.set(`b2b:lease:${leaseId}`, JSON.stringify(lease));
        await redis.del(`b2b:active-lease:${lease.consumerClientId}:${lease.taskKey}`);
        
        return true;
    }
}

export const heuristicMarketplace = new HeuristicMarketplace();
