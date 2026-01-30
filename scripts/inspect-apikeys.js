
import 'dotenv/config';
import { db } from '../src/db/client.js';
import { sql } from 'drizzle-orm';

async function inspect() {
    console.log("Inspecting api_keys table...");
    try {
        // Raw query to see actual columns
        const result = await db.execute(sql`SELECT * FROM api_keys LIMIT 1`);
        console.log("Columns found:", Object.keys(result[0] || {}));
        console.log("First row sample:", result[0]);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
inspect();
