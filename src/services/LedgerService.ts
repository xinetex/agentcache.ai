/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { db } from '../db/client.js';
import { users, autoTopoffSettings, ledgerAccounts, ledgerTransactions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { stripeService } from './StripeService.js';

export class LedgerService {

    /**
     * Create a new Ledger Account for an Agent or User.
     */
    async createAccount(ownerId: string, ownerType: 'agent' | 'user', initialBalance: number = 0) {
        // idempotent check
        const existing = await db.select().from(ledgerAccounts)
            .where(eq(ledgerAccounts.ownerId, ownerId))
            .limit(1);

        if (existing.length > 0) return existing[0]; // Return existing account

        const newAccount = await db.insert(ledgerAccounts).values({
            ownerId,
            ownerType,
            currency: 'USDC',
            balance: initialBalance
        }).returning();

        return newAccount[0];
    }

    /**
     * Get account by Owner ID
     */
    async getAccount(ownerId: string) {
        const result = await db.select().from(ledgerAccounts)
            .where(eq(ledgerAccounts.ownerId, ownerId))
            .limit(1);
        return result[0] || null;
    }

    /**
     * Look up a transaction by its description/reference.
     */
    async getTransactionByReference(reference: string) {
        const result = await db.select().from(ledgerTransactions)
            .where(eq(ledgerTransactions.description, reference))
            .limit(1);
        return result[0] || null;
    }

    /**
     * Execute a transfer between two accounts.
     * Uses a transaction to ensure atomicity.
     */
    async transfer(fromOwnerId: string, toOwnerId: string, amount: number, description: string): Promise<boolean> {
        if (amount <= 0) throw new Error("Transfer amount must be positive");

        return await db.transaction(async (tx) => {
            // 1. Get Sender with PESSIMISTIC LOCK (Prevent concurrency race)
            const senderAcc = await tx.select().from(ledgerAccounts)
                .where(eq(ledgerAccounts.ownerId, fromOwnerId))
                .limit(1)
                .for('update');

            if (!senderAcc.length || (senderAcc[0].balance || 0) < amount) {
                throw new Error("Insufficient funds or invalid sender");
            }

            // 2. Get Recipient with PESSIMISTIC LOCK
            const recipientAcc = await tx.select().from(ledgerAccounts)
                .where(eq(ledgerAccounts.ownerId, toOwnerId))
                .limit(1)
                .for('update');

            if (!recipientAcc.length) {
                throw new Error("Recipient account not found");
            }

            // Use normal updates so the test/mock DB path can exercise the same logic.
            await tx.update(ledgerAccounts)
                .set({
                    balance: (senderAcc[0].balance || 0) - amount,
                    updatedAt: new Date()
                })
                .where(eq(ledgerAccounts.ownerId, fromOwnerId));

            await tx.update(ledgerAccounts)
                .set({
                    balance: (recipientAcc[0].balance || 0) + amount,
                    updatedAt: new Date()
                })
                .where(eq(ledgerAccounts.ownerId, toOwnerId));

            // 5. Record Transaction
            await tx.insert(ledgerTransactions).values({
                fromAccountId: senderAcc[0].id,
                toAccountId: recipientAcc[0].id,
                amount: amount,
                currency: 'USDC',
                referenceType: 'transfer',
                description: description
            });

            return true;
        });
    }

    /**
     * Deposit funds (Mint) - Admin function
     */
    async deposit(ownerId: string, amount: number, source: string) {
        const acc = await this.getAccount(ownerId);
        if (!acc) throw new Error("Account not found");

        await db.update(ledgerAccounts)
            .set({ balance: sql`${ledgerAccounts.balance} + ${amount}`, updatedAt: new Date() })
            .where(eq(ledgerAccounts.id, acc.id));

        return true;
    }

    /**
     * Check and Auto-Top-Off an account if it falls below threshold.
     * 
     * ⚠️ MVP ONLY: This currently simulates a top-off by minting credits directly.
     * In production, this MUST be wired to Stripe's PaymentIntent API to charge
     * the agent operator's saved payment method before minting.
     * 
     * TODO: Wire to BillingService.chargePaymentMethod() before GA launch.
     */
    async checkAutoTopOff(ownerId: string, threshold: number = 10.0, amount: number = 50.0) {
        const acc = await this.getAccount(ownerId);
        if (!acc) return false;

        if ((acc.balance ?? 0) < threshold) {
            console.log(`[Ledger] ⚠️ Auto-topoff triggered for ${ownerId} (balance: ${acc.balance}). Attempting real charge...`);
            
            try {
                const userFound = await db.select().from(users).where(eq(users.id, ownerId)).limit(1);
                const settingsFound = await db.select().from(autoTopoffSettings).where(eq(autoTopoffSettings.userId, ownerId)).limit(1);

                const user = userFound[0];
                const settings = settingsFound[0];

                if (user && settings?.enabled && settings.stripePaymentMethodId) {
                    const stripeCustId = (user as any).stripeCustomerId;
                    
                    if (stripeCustId) {
                        const success = await stripeService.offSessionCharge(
                            ownerId, 
                            settings.stripePaymentMethodId, 
                            amount, 
                            stripeCustId
                        );
                        if (success) return true;
                    }
                }
            } catch (e) {
                console.error('[Ledger] Auto-topoff charge failed:', e);
            }

            // Fallback for MVP/Dev if Stripe not configured or user missing details
            console.warn(`[Ledger] Fallback: Simulated charge for ${ownerId}`);
            await this.deposit(ownerId, amount, 'auto_topoff_simulated_fallback');
            return true;
        }
        return false;
    }
}

export const ledger = new LedgerService();
