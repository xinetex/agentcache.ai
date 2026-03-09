
import { db } from '../db/client.js';
import { ledgerAccounts, ledgerTransactions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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

            // 3 & 4. Updates via Raw SQL to ensure atomicity and precision
            await tx.execute(sql`UPDATE ledger_accounts SET balance = balance - ${amount}, updated_at = NOW() WHERE owner_id = ${fromOwnerId}`);
            await tx.execute(sql`UPDATE ledger_accounts SET balance = balance + ${amount}, updated_at = NOW() WHERE owner_id = ${toOwnerId}`);

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
            console.warn(`[Ledger] ⚠️ Auto-topoff triggered for ${ownerId} (balance: ${acc.balance}). MVP: Simulated charge.`);
            await this.deposit(ownerId, amount, 'auto_topoff_simulated');
            return true;
        }
        return false;
    }
}

export const ledger = new LedgerService();
