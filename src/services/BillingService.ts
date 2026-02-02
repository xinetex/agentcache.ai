
import { redis } from '../lib/redis.js';

export const CORE_ACCOUNT = 'master_treasury';

export const PRICING = {
    MOTION_PLAN: 1,      // Cheap, frequent
    RISK_ASSESS: 10,     // Moderate compute
    PROTEIN_FOLD: 50     // Expensive (GPU)
};

export class BillingService {

    /**
     * Get current credit balance.
     */
    async getBalance(accountId: string = CORE_ACCOUNT): Promise<number> {
        const bal = await redis.get(`billing:${accountId}:balance`);
        return parseInt((bal as string) || '1000'); // Default start with 1000 credits
    }

    /**
     * Deduct credits. Throws error if insufficient funds.
     */
    async charge(cost: number, description: string, accountId: string = CORE_ACCOUNT): Promise<boolean> {
        const key = `billing:${accountId}:balance`;

        // Atomic Check-and-Decr would be ideal (Lua script), 
        // but for MVP we'll do Get -> Check -> Decr (risk of race condition accepted for now).
        const current = await this.getBalance(accountId);

        if (current < cost) {
            throw new Error(`Insufficient Credits. Cost: ${cost}, Balance: ${current}`);
        }

        await redis.decrby(key, cost);

        // Audit Log (Fire and forget)
        this.logTransaction(accountId, -cost, description);

        return true;
    }

    /**
     * Add credits (Profit/Top-up)
     */
    async deposit(amount: number, description: string, accountId: string = CORE_ACCOUNT) {
        await redis.incrby(`billing:${accountId}:balance`, amount);
        this.logTransaction(accountId, amount, description);
    }

    private logTransaction(accountId: string, amount: number, desc: string) {
        const logEntry = JSON.stringify({
            ts: Date.now(),
            amount,
            desc
        });
        // Keep last 100 transactions
        redis.lpush(`billing:${accountId}:ledger`, logEntry);
        redis.ltrim(`billing:${accountId}:ledger`, 0, 99);
    }

    async getLedger(accountId: string = CORE_ACCOUNT) {
        const logs = await redis.lrange(`billing:${accountId}:ledger`, 0, 20);
        return logs.map(s => JSON.parse(s));
    }
}
