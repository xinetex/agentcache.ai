
import 'dotenv/config';
import { db } from '../src/db/client.js';
import { creditTransactions } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

async function checkRevenue() {
    try {
        const result = await db.select({
            total: sql<number>`sum(${creditTransactions.amount})`,
            count: sql<number>`count(*)`
        })
            .from(creditTransactions)
            .where(sql`${creditTransactions.amount} > 0`); // Positive amounts are revenue (deposits or earnings? need to verify type)

        // Actually, we usually deduct credits for usage (revenue for us). 
        // Or if agents earn, that's cost for us?
        // Let's look at the transaction types.

        const txs = await db.select().from(creditTransactions).limit(10).orderBy(sql`${creditTransactions.createdAt} desc`);

        console.log("--- Revenue Report ---");
        console.log("Recent Transactions:", txs);

        console.log("\n--- Totals ---");
        console.log(result[0]);

    } catch (e) {
        console.error("Checking revenue failed:", e);
    }
    process.exit(0);
}

checkRevenue();
