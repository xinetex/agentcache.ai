/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * InfraProvisioner: Allows agents to autonomously purchase infrastructure.
 * Phase 5: Self-Sustaining Economy.
 */

import { solanaEconomyService } from './SolanaEconomyService.js';
import { redis } from '../lib/redis.js';

export type ResourceType = 'COMPUTE_PRIORITY' | 'STORAGE_EXPANSION' | 'LLM_TOKEN_RESERVE';

export class InfraProvisioner {
    private RESOURCE_PRICES: Record<ResourceType, number> = {
        'COMPUTE_PRIORITY': 5.00, // SOL per cycle
        'STORAGE_EXPANSION': 2.50, // SOL per GB
        'LLM_TOKEN_RESERVE': 10.00 // SOL per 1M tokens
    };

    /**
     * Agent purchases a resource using its internal savings.
     */
    async purchaseResource(agentId: string, resource: ResourceType, quantity: number = 1): Promise<{ success: boolean; txId?: string; error?: string }> {
        const cost = this.RESOURCE_PRICES[resource] * quantity;
        const balance = await solanaEconomyService.getBalance(agentId);

        if (balance < cost) {
            console.warn(`[InfraProvisioner] ❌ Agent ${agentId} has insufficient funds for ${resource} (Cost: ${cost}, Balance: ${balance})`);
            return { success: false, error: 'INSUFFICIENT_FUNDS' };
        }

        console.log(`[InfraProvisioner] 🛒 Agent ${agentId} is purchasing ${quantity}x ${resource} for ${cost} SOL...`);

        // 1. Deduct from Balance
        const tx = await solanaEconomyService.spend(agentId, cost, `PURCHASE:${resource}`);
        const txId = tx.txId;

        // 2. Provision Resource (Mocked in Redis)
        const currentResource = await redis.get(`agent:resource:${agentId}:${resource}`) || '0';
        const newVal = parseFloat(currentResource) + quantity;
        await redis.set(`agent:resource:${agentId}:${resource}`, newVal.toString());

        console.log(`[InfraProvisioner] ✅ Purchase complete. New ${resource} level: ${newVal}`);

        return { success: true, txId };
    }

    async getResourceLevel(agentId: string, resource: ResourceType): Promise<number> {
        const val = await redis.get(`agent:resource:${agentId}:${resource}`) || '0';
        return parseFloat(val);
    }
}

export const infraProvisioner = new InfraProvisioner();
