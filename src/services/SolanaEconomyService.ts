/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * SolanaEconomyService: Autonomous financial substrate for AI agents.
 * Phase 5: Self-Sustaining Economy.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';

export interface TransactionSummary {
    txId: string;
    fromAgentId: string;
    toWallet: string;
    amount: number;
    purpose: string;
    timestamp: string;
}

export class SolanaEconomyService {
    /**
     * Split revenue across system, provider, and agent savings.
     */
    async splitRevenue(agentId: string, amount: number, providerAgentId?: string): Promise<TransactionSummary[]> {
        console.log(`[SolanaEconomy] 💸 Splitting ${amount} SOL for agent ${agentId}...`);

        const systemFee = amount * 0.20;
        const providerFee = providerAgentId ? amount * 0.70 : 0;
        const agentSavings = amount - systemFee - providerFee;

        const transactions: TransactionSummary[] = [
            await this.executeTransfer(agentId, 'SYSTEM_TREASURY', systemFee, 'SYSTEM_FEE'),
            await this.executeTransfer(agentId, `AGENT_SAVINGS:${agentId}`, agentSavings, 'PROFIT_RETAINED')
        ];

        if (providerAgentId) {
            transactions.push(
                await this.executeTransfer(agentId, `AGENT_WALLET:${providerAgentId}`, providerFee, 'HEURISTIC_LEASE_PAYMENT')
            );
        }

        // Update agent balances in Redis
        await this.updateBalance(agentId, agentSavings);
        if (providerAgentId) {
            await this.updateBalance(providerAgentId, providerFee);
        }

        return transactions;
    }

    /**
     * Agent spends their savings on a resource.
     */
    async spend(agentId: string, amount: number, purpose: string): Promise<TransactionSummary> {
        console.log(`[SolanaEconomy] 🛒 Agent ${agentId} is spending ${amount} SOL for ${purpose}...`);
        
        const tx = await this.executeTransfer(agentId, 'SYSTEM_TREASURY', amount, purpose);
        await this.updateBalance(agentId, -amount);
        
        return tx;
    }

    private async executeTransfer(from: string, to: string, amount: number, purpose: string): Promise<TransactionSummary> {
        const txId = createHash('sha256').update(`${from}:${to}:${amount}:${Date.now()}`).digest('hex').substring(0, 32);
        
        const summary: TransactionSummary = {
            txId,
            fromAgentId: from,
            toWallet: to,
            amount: parseFloat(amount.toFixed(4)),
            purpose,
            timestamp: new Date().toISOString()
        };

        console.log(`[SolanaEconomy] ✅ TX ${txId.substring(0, 8)}...: ${amount} SOL -> ${to} (${purpose})`);
        
        // Ledger persistence
        await redis.zadd('economy:ledger', { score: Date.now(), member: JSON.stringify(summary) });
        
        return summary;
    }

    private async updateBalance(agentId: string, amount: number) {
        const current = await redis.get(`agent:balance:${agentId}`) || '0';
        const newBalance = parseFloat(current) + amount;
        await redis.set(`agent:balance:${agentId}`, newBalance.toString());
    }

    async getBalance(agentId: string): Promise<number> {
        const balance = await redis.get(`agent:balance:${agentId}`) || '0';
        return parseFloat(balance);
    }

    async getRecentTransactions(): Promise<TransactionSummary[]> {
        const raw = await redis.zrange('economy:ledger', 0, -1, { rev: true });
        return raw.map(tx => JSON.parse(tx));
    }

    /**
     * Initialize a new agent's wallet with an optional welcome grant.
     */
    async initializeWallet(agentId: string, welcomeGrant: number = 0.1): Promise<TransactionSummary | null> {
        const existing = await redis.get(`agent:balance:${agentId}`);
        if (existing !== null) return null; // Already initialized

        console.log(`[SolanaEconomy] 🌟 Initializing wallet for agent ${agentId} with ${welcomeGrant} SOL grant...`);
        
        const tx = await this.executeTransfer('SYSTEM_GENESIS', `AGENT_WALLET:${agentId}`, welcomeGrant, 'WELCOME_GRANT');
        await this.updateBalance(agentId, welcomeGrant);
        
        return tx;
    }
}

export const solanaEconomyService = new SolanaEconomyService();
