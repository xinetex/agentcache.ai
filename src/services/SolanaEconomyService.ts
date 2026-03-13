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
    signature?: string;
    status: 'PENDING' | 'CONFIRMED' | 'FAILED'; // Phase 10: Asynchronous Settlement
    confirmations: number;
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

    /**
     * Create a structured proof for a transaction (Phase 9).
     */
    async createTransactionProof(
        from: string, 
        to: string, 
        amount: number, 
        purpose: string
    ): Promise<string> {
        const payload = `${from}:${to}:${amount}:${purpose}:${Date.now()}:${Math.random()}`;
        return createHash('sha256').update(payload).digest('hex').substring(0, 16).toUpperCase();
    }

    /**
     * Internal: Executes a virtual transfer and returns a summary.
     */
    async executeTransfer(from: string, to: string, amount: number, purpose: string): Promise<TransactionSummary> {
        const txId = createHash('sha256').update(`${from}:${to}:${amount}:${Date.now()}:${Math.random()}`).digest('hex').substring(0, 32);
        const signature = await this.createTransactionProof(from, to, amount, purpose);
        
        const summary: TransactionSummary = {
            txId,
            fromAgentId: from,
            toWallet: to,
            amount: parseFloat(amount.toFixed(4)),
            purpose,
            timestamp: new Date().toISOString(),
            signature,
            status: 'PENDING',
            confirmations: 0
        };

        console.log(`[SolanaEconomy] ⏳ TX ${txId.substring(0, 8)} PENDING | ${amount} SOL -> ${to}`);
        
        // Ledger persistence
        await redis.set(`tx:${txId}`, JSON.stringify(summary));
        await redis.zadd('economy:ledger', { score: Date.now(), member: txId });
        
        return summary;
    }

    /**
     * Mimic finality confirmation.
     */
    async confirmTransaction(txId: string): Promise<TransactionSummary | null> {
        const raw = await redis.get(`tx:${txId}`);
        if (!raw) return null;

        const tx: TransactionSummary = JSON.parse(raw);
        if (tx.status === 'CONFIRMED') return tx;

        tx.confirmations += 1;
        if (tx.confirmations >= 3) {
            tx.status = 'CONFIRMED';
            console.log(`[SolanaEconomy] ✅ TX ${txId.substring(0, 8)} CONFIRMED`);
        }

        await redis.set(`tx:${txId}`, JSON.stringify(tx));
        return tx;
    }

    /**
     * Conserve total liquidity: sum(balances) == initial_supply + grants.
     */
    async validateLedgerEquilibrium(): Promise<{ balanced: boolean; drift: number }> {
        const txs = await this.getRecentTransactions();
        const balances = await redis.keys('agent:balance:*');
        
        let totalHeld = 0;
        for (const key of balances) {
            const val = await redis.get(key) || '0';
            totalHeld += parseFloat(val);
        }

        let totalInjected = 0;
        for (const tx of txs) {
            if (tx.fromAgentId === 'SYSTEM_GENESIS') {
                totalInjected += tx.amount;
            }
        }

        const drift = Math.abs(totalHeld - totalInjected);
        const balanced = drift < 0.0001;

        if (!balanced) {
            console.error(`[SolanaEconomy] 🚨 Equilibrium Breach! Drift: ${drift.toFixed(6)} SOL`);
        } else {
            console.log(`[SolanaEconomy] ⚖️ Equilibrium Validated. Total: ${totalHeld.toFixed(4)} SOL`);
        }

        return { balanced, drift };
    }

    /**
     * Update an agent's balance in the substrate cache.
     */
    async updateBalance(agentId: string, amount: number) {
        const current = await redis.get(`agent:balance:${agentId}`) || '0';
        const newBalance = parseFloat(current) + amount;
        await redis.set(`agent:balance:${agentId}`, newBalance.toString());
    }

    async getBalance(agentId: string): Promise<number> {
        const balance = await redis.get(`agent:balance:${agentId}`) || '0';
        return parseFloat(balance);
    }

    async getRecentTransactions(): Promise<TransactionSummary[]> {
        const ids = await redis.zrange('economy:ledger', 0, -1, { rev: true });
        const txs = await Promise.all(ids.map(async id => {
            const raw = await redis.get(`tx:${id}`);
            return raw ? JSON.parse(raw) : null;
        }));
        return txs.filter(tx => tx !== null);
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

    /**
     * Process a recurring lease payment (Phase 8).
     */
    async processLease(leaseId: string, consumerId: string, providerId: string, amount: number): Promise<TransactionSummary[]> {
        console.log(`[SolanaEconomy] 🧾 Processing lease payment for ${leaseId} (Consumer: ${consumerId})...`);

        // Splits for Phase 8: 70% System (Platform Owned Swarms) / 30% Provider (if external)
        // If provider is a platform auditor, system captures 100%
        const isPlatformAuditor = providerId.startsWith('auditor_') || providerId.startsWith('fintech_') || providerId.startsWith('legal_');
        
        const systemFee = isPlatformAuditor ? amount : amount * 0.70;
        const providerFee = amount - systemFee;

        const transactions: TransactionSummary[] = [
            await this.executeTransfer(consumerId, 'SYSTEM_TREASURY', systemFee, `LEASE_PAYMENT:${leaseId}`)
        ];

        if (providerFee > 0) {
            transactions.push(
                await this.executeTransfer(consumerId, `AGENT_WALLET:${providerId}`, providerFee, `LEASE_PROFIT:${leaseId}`)
            );
            await this.updateBalance(providerId, providerFee);
        }

        await this.updateBalance(consumerId, -amount);

        return transactions;
    }
}

export const solanaEconomyService = new SolanaEconomyService();
