
import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function debugDB() {
    console.log("🕵️‍♀️ Debugging Database connection...");

    try {
        // 1. Check Table Info
        const info = await db.execute(sql`
            SELECT table_schema, table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('api_keys', 'members');
        `);
        console.log("Found Columns:");
        console.table(info.map(r => ({ schema: r.table_schema, table: r.table_name, column: r.column_name })));

        // 2. Try Raw Select
        console.log("\nAttempting SELECT * FROM users...");
        const res = await db.execute(sql`SELECT * FROM users LIMIT 1`);
        console.log("Query Success. Rows:", res.length);
        if (res.length > 0) {
            console.log("Row keys:", Object.keys(res[0]));
        }

    } catch (e) {
        console.error("Debug Query Failed:", e);
    }
    process.exit(0);
}

debugDB();
