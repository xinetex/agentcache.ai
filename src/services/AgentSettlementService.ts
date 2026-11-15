/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { ledger } from './LedgerService.js';
import { db } from '../db/client.js';
import { legalContracts } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export interface SettlementResult {
    success: boolean;
    authorized: boolean;
    remainingBudget?: number;
    error?: string;
}

// Canonical UUID for the Master Treasury
export const MASTER_TREASURY_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Experimental agent settlement remains disabled until its payment and accounting controls are production verified.
 */
export class AgentSettlementService {

    /**
     * Validate a Preauthorization token and settle the base cost.
     * Optionally verify an on-chain Transaction Hash for real-money settlements.
     */
    async settle(_tokenId: string, _agentId: string, _estimatedCost: number, _options?: { txHash?: string; agentWallet?: string }): Promise<SettlementResult> {
        // Machine-to-machine settlement stays disabled until payment payloads,
        // replay protection, treasury custody, and accounting are verified.
        // In particular, token-shaped input must never mint ledger balance.
        return { success: false, authorized: false, error: 'x402_settlement_disabled' };
    }

    /**
     * Policy check to see if an agent is within their "Mission Budget"
     */
    async checkMissionQuota(agentId: string, missionId: string): Promise<boolean> {
        // Future: Check Redis-backed mission budget limits
        return true;
    }

    /**
     * Autonomous Revenue Distribution: Distributes settled revenue across swarm participants
     * based on the binding Symbiont Legal Contract metadata.
     */
    async distributeRevenue(swarmId: string, totalAmount: number): Promise<boolean> {
        console.log(`[Settlement] 💸 Distributing ${totalAmount} for Swarm ${swarmId} based on Legal Bridge...`);

        try {
            // 1. Resolve the latest binding contract for this swarm
            const contracts = await db.select()
                .from(legalContracts)
                .where(eq(legalContracts.swarmId, swarmId))
                .orderBy(desc(legalContracts.updatedAt))
                .limit(1);

            if (contracts.length === 0) {
                console.warn(`[Settlement] ⚠️ No legal contract found for Swarm ${swarmId}. Defaulting to Treasury.`);
                return false;
            }

            const contract = contracts[0];
            const metadata = contract.metadata as any; // { actors: [...], splits: {...} }

            if (!metadata.actors || !Array.isArray(metadata.actors)) {
                console.error(`[Settlement] ❌ Contract ${contract.id} has no participant metadata.`);
                return false;
            }

            // 2. Perform splits (Simplified: Equal split for MVP, or weighted if metadata.splits exists)
            const participantCount = metadata.actors.length;
            const amountPerParticipant = totalAmount / participantCount;

            console.log(`[Settlement] 📊 Splitting ${totalAmount} across ${participantCount} actors (${amountPerParticipant} each)`);

            for (const actor of metadata.actors) {
                const referenceId = `rev_split:${swarmId}:${actor.id}:${Date.now()}`;
                
                // Ensure participant account exists
                let account = await ledger.getAccount(actor.id);
                if (!account) {
                    await ledger.createAccount(actor.id, 'agent', 0);
                }

                // Transfer from Treasury pool to Agent
                // This reverses the flow: Treasury -> Participants
                await ledger.transfer(MASTER_TREASURY_ID, actor.id, amountPerParticipant, referenceId);
                console.log(`   ✅ Credited Agent ${actor.name} (${actor.id})`);
            }

            return true;
        } catch (error: any) {
            console.error(`[Settlement] ❌ Revenue distribution failed for ${swarmId}:`, error.message);
            return false;
        }
    }
}

export const agentSettlementService = new AgentSettlementService();
