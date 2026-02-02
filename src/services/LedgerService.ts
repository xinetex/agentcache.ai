
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
     * Execute a transfer between two accounts.
     * Uses a transaction to ensure atomicity.
     */
    async transfer(fromOwnerId: string, toOwnerId: string, amount: number, description: string): Promise<boolean> {
        if (amount <= 0) throw new Error("Transfer amount must be positive");

        return await db.transaction(async (tx) => {
            // 1. Get Sender
            const senderAcc = await tx.select().from(ledgerAccounts)
                .where(eq(ledgerAccounts.ownerId, fromOwnerId))
                .limit(1);

            if (!senderAcc.length || (senderAcc[0].balance || 0) < amount) {
                throw new Error("Insufficient funds or invalid sender");
            }

            // 2. Get Recipient
            const recipientAcc = await tx.select().from(ledgerAccounts)
                .where(eq(ledgerAccounts.ownerId, toOwnerId))
                .limit(1);

            if (!recipientAcc.length) {
                throw new Error("Recipient account not found");
            }

            // 3. Deduct from Sender
            await tx.update(ledgerAccounts)
                .set({ balance: sql`${ledgerAccounts.balance} - ${amount}`, updatedAt: new Date() })
                .where(eq(ledgerAccounts.id, senderAcc[0].id));

            // 4. Add to Recipient
            await tx.update(ledgerAccounts)
                .set({ balance: sql`${ledgerAccounts.balance} + ${amount}`, updatedAt: new Date() })
                .where(eq(ledgerAccounts.id, recipientAcc[0].id));

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
     * This ensures "Consistent Payments" and uninterrupted service.
     */
    async checkAutoTopOff(ownerId: string, threshold: number = 10.0, amount: number = 50.0) {
        const acc = await this.getAccount(ownerId);
        if (!acc) return false;

        if (acc.balance < threshold) {
            console.log(`[Ledger] Account ${ownerId} balance ($${acc.balance}) below threshold ($${threshold}). Triggering Top-Off...`);
            // In a real app, this would charge the User's linked Stripe card.
            // Here, we simulate a successful charge and mint.
            await this.deposit(ownerId, amount, 'auto_topoff');
            console.log(`[Ledger] Successfully topped off $${amount}. New Balance: $${acc.balance + amount}`);
            return true;
        }
        return false;
    }
}

export const ledger = new LedgerService();
