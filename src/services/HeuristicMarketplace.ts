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
    subscriptionType?: 'ONCE' | 'MONTHLY';
}

export class HeuristicMarketplace {
    /**
     * Create a new lease for a mature heuristic.
     */
    async leaseHeuristic(
        providerAgentId: string, 
        consumerClientId: string, 
        taskKey: string,
        instructions: string,
        subscriptionType: HeuristicLease['subscriptionType'] = 'ONCE'
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
            dailyFee: 25.00, // Standard daily rate for L3+ heuristics
            subscriptionType
        };

        console.log(`[HeuristicMarketplace] 💸 New lease ${id} created for ${taskKey} (Provider: ${providerAgentId}, Type: ${subscriptionType})`);
        
        // Store the lease
        await redis.set(`b2b:lease:${id}`, JSON.stringify(lease));
        // Map client/task to active lease
        await redis.set(`b2b:active-lease:${consumerClientId}:${taskKey}`, id);
        
        // Add to global subscription list if monthly
        if (subscriptionType === 'MONTHLY') {
            await redis.sadd('b2b:subscriptions:active', id);
        }

        return lease;
    }

    /**
     * Renew an existing lease.
     */
    async renewLease(leaseId: string): Promise<HeuristicLease | null> {
        const data = await redis.get(`b2b:lease:${leaseId}`);
        if (!data) return null;

        const lease: HeuristicLease = JSON.parse(data);
        const nextExpiration = new Date(new Date(lease.expiresAt).getTime() + 30 * 24 * 60 * 60 * 1000);
        
        lease.expiresAt = nextExpiration.toISOString();
        lease.status = 'ACTIVE';

        await redis.set(`b2b:lease:${leaseId}`, JSON.stringify(lease));
        console.log(`[HeuristicMarketplace] ♻️ Lease ${leaseId} renewed until ${lease.expiresAt}`);
        
        return lease;
    }

    /**
     * Get all active monthly subscriptions.
     */
    async getActiveSubscriptions(): Promise<string[]> {
        return await redis.smembers('b2b:subscriptions:active');
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
        await redis.srem('b2b:subscriptions:active', leaseId);
        
        return true;
    }
}

export const heuristicMarketplace = new HeuristicMarketplace();
