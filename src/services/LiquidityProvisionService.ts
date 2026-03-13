/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * LiquidityProvisionService: Autonomous capital allocation for agentic swarms.
 * Phase 14: Social-Economic Bridge.
 */

import { redis } from '../lib/redis.js';
import { solanaEconomyService } from './SolanaEconomyService.js';
import { escrowService } from './EscrowService.js';

export interface LiquidityProvision {
    id: string;
    targetSwarmId: string;
    amount: number; // in SOL
    source: 'SOCIAL_TREND' | 'MARKET_GAP' | 'DIRECT_REQUEST';
    status: 'PENDING' | 'PROVISIONED' | 'EXHAUSTED';
    timestamp: string;
}

export class LiquidityProvisionService {
    /**
     * Provision liquidity to a target swarm.
     */
    async provisionLiquidity(swarmId: string, amount: number, source: LiquidityProvision['source']): Promise<LiquidityProvision> {
        const id = `liq-${Math.random().toString(36).substring(7)}`;
        console.log(`[LiquidityProvision] 💰 Provisioning ${amount} SOL to swarm ${swarmId} from ${source}...`);

        const provision: LiquidityProvision = {
            id,
            targetSwarmId: swarmId,
            amount,
            source,
            status: 'PENDING',
            timestamp: new Date().toISOString()
        };

        // 1. Check substrate treasury balance (simulation)
        // In a real ACP-enabled substrate, this would check a multisig or treasury DAO
        
        // 2. Lock funds in Escrow for the swarm
        // We use the existing EscrowService but label it as LIQUIDITY_RESERVE
        try {
            // For now, we simulate the settlement to PROVISIONED
            provision.status = 'PROVISIONED';
            
            await redis.hset('economy:liquidity-provisions', id, JSON.stringify(provision));
            await redis.lpush(`swarm:liquidity:${swarmId}`, JSON.stringify(provision));
            
            // Record the transaction in the economic ledger
            await this.logLiquidityEvent(provision);

            return provision;
        } catch (error) {
            console.error(`[LiquidityProvision] ❌ Failed to provision liquidity:`, error);
            throw error;
        }
    }

    private async logLiquidityEvent(provision: LiquidityProvision) {
        // Record as a system expense / investment in the global ledger
        // This makes it visible to the EconomicAuditService
        const event = {
            txId: `tx-${provision.id}`,
            amount: -provision.amount,
            purpose: `LIQUIDITY_PROVISION:${provision.source}:${provision.targetSwarmId}`,
            timestamp: provision.timestamp,
            signature: 'SYS_AUTH_SIG_16'
        };

        await redis.lpush('economy:ledger', JSON.stringify(event));
    }

    /**
     * Get all active liquidity provisions for a swarm.
     */
    async getSwarmLiquidity(swarmId: string): Promise<LiquidityProvision[]> {
        const data = await redis.lrange(`swarm:liquidity:${swarmId}`, 0, -1);
        return data.map(d => JSON.parse(d));
    }

    /**
     * Get global liquidity stats.
     */
    async getGlobalStats() {
        const allProvisions = await redis.hgetall('economy:liquidity-provisions');
        const provisions = Object.values(allProvisions).map(v => JSON.parse(v as string)) as LiquidityProvision[];
        
        const totalProvisioned = provisions.reduce((sum, p) => sum + p.amount, 0);
        
        return {
            total_provisioned_sol: totalProvisioned,
            active_provisions_count: provisions.filter(p => p.status === 'PROVISIONED').length,
            latest_provisions: provisions.slice(-5)
        };
    }
}

export const liquidityProvisionService = new LiquidityProvisionService();
