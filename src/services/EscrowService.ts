/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * EscrowService: Manages secure "Hold-and-Release" patterns for B2B deals.
 * Phase 9: Economy & Settlement Hardening.
 */

import { redis } from '../lib/redis.js';
import { solanaEconomyService } from './SolanaEconomyService.js';

export interface EscrowDeal {
    id: string;
    consumerId: string;
    providerId: string;
    auditorId?: string;
    amount: number;
    status: 'HELD' | 'PENDING_RELEASE' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';
    purpose: string;
    releaseTxId?: string; // Phase 10: Track settlement TX
    signatures: {
        consumer?: boolean;
        provider?: boolean;
        auditor?: boolean;
    };
    expiresAt: string;
}

export class EscrowService {
    /**
     * Create a new escrow hold for a B2B deal.
     */
    async createEscrow(
        consumerId: string, 
        providerId: string, 
        amount: number, 
        purpose: string,
        auditorId?: string
    ): Promise<EscrowDeal> {
        const id = `escrow-${Math.random().toString(36).substring(7).toUpperCase()}`;
        
        const deal: EscrowDeal = {
            id,
            consumerId,
            providerId,
            auditorId,
            amount,
            status: 'HELD',
            purpose,
            signatures: {},
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 day hold
        };

        console.log(`[Escrow] 🔒 Holding ${amount} SOL in escrow ${id} for: ${purpose}`);
        
        // Execute the transfer to the system escrow account
        await solanaEconomyService.executeTransfer(consumerId, 'SYSTEM_ESCROW', amount, `ESCROW_HOLD:${id}`);
        await solanaEconomyService.updateBalance(consumerId, -amount);

        await redis.set(`b2b:escrow:${id}`, JSON.stringify(deal));
        return deal;
    }

    /**
     * Sign a deal to release funds.
     */
    async signEscrow(id: string, agentId: string): Promise<EscrowDeal> {
        const data = await redis.get(`b2b:escrow:${id}`);
        if (!data) throw new Error(`Escrow ${id} not found.`);

        const deal: EscrowDeal = JSON.parse(data);
        
        if (agentId === deal.consumerId) deal.signatures.consumer = true;
        else if (agentId === deal.providerId) deal.signatures.provider = true;
        else if (agentId === deal.auditorId) deal.signatures.auditor = true;
        else throw new Error(`Agent ${agentId} is not a party to escrow ${id}.`);

        console.log(`[Escrow] ✍️ Agent ${agentId} signed escrow ${id}.`);

        // Logic: Require Consumer AND (Provider OR Auditor) to release
        const canRelease = deal.signatures.consumer && (deal.signatures.provider || (deal.auditorId && deal.signatures.auditor));
        
        if (canRelease) {
            await this.releaseEscrow(deal);
        } else {
            await redis.set(`b2b:escrow:${id}`, JSON.stringify(deal));
        }

        return deal;
    }

    private async releaseEscrow(deal: EscrowDeal) {
        console.log(`[Escrow] ⏳ Initiating release for escrow ${deal.id} to provider ${deal.providerId}...`);
        
        // Phase 10: Execute transfer and track TX
        const tx = await solanaEconomyService.executeTransfer('SYSTEM_ESCROW', deal.providerId, deal.amount, `ESCROW_RELEASE:${deal.id}`);
        
        deal.status = 'PENDING_RELEASE';
        deal.releaseTxId = tx.txId;
        await redis.set(`b2b:escrow:${deal.id}`, JSON.stringify(deal));
    }

    /**
     * Polling method to finalize a deal once settlement is confirmed.
     */
    async finalizeRelease(id: string): Promise<boolean> {
        const data = await redis.get(`b2b:escrow:${id}`);
        if (!data) return false;

        const deal: EscrowDeal = JSON.parse(data);
        if (deal.status !== 'PENDING_RELEASE' || !deal.releaseTxId) return false;

        // Try to confirm the settlement (Phase 10 transition)
        const tx = await solanaEconomyService.confirmTransaction(deal.releaseTxId);
        
        if (tx && tx.status === 'CONFIRMED') {
            console.log(`[Escrow] 🔓 Finalized release for escrow ${deal.id}.`);
            await solanaEconomyService.updateBalance(deal.providerId, deal.amount);
            deal.status = 'RELEASED';
            await redis.set(`b2b:escrow:${deal.id}`, JSON.stringify(deal));
            return true;
        }

        return false;
    }

    /**
     * Refund an escrow (if expired or cancelled).
     */
    async refundEscrow(id: string): Promise<boolean> {
        const data = await redis.get(`b2b:escrow:${id}`);
        if (!data) return false;

        const deal: EscrowDeal = JSON.parse(data);
        if (deal.status !== 'HELD') return false;

        console.log(`[Escrow] ↩️ Refunding escrow ${id} to consumer ${deal.consumerId}...`);
        
        await solanaEconomyService.executeTransfer('SYSTEM_ESCROW', deal.consumerId, deal.amount, `ESCROW_REFUND:${id}`);
        await solanaEconomyService.updateBalance(deal.consumerId, deal.amount);

        deal.status = 'REFUNDED';
        await redis.set(`b2b:escrow:${id}`, JSON.stringify(deal));
        return true;
    }
}

export const escrowService = new EscrowService();
