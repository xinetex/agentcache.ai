import { db } from '../src/db/client.js';
import { maturityLedger } from '../src/db/schema.js';

async function debug() {
    const results = await db.select().from(maturityLedger);
    console.log("Maturity Ledger Contents:", JSON.stringify(results, null, 2));
    process.exit(0);
}

debug();
