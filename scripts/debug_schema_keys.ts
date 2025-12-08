
import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';

async function checkKeysSchema() {
    console.log("🔍 Checking 'api_keys' table schema...");
    try {
        const columns = await db.execute(sql`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns 
            WHERE table_name = 'api_keys'
        `);

        console.log("\n📋 Columns found:");
        columns.forEach(c => console.log(`   - ${c.column_name} (Type: ${c.data_type}, UDT: ${c.udt_name})`));

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

checkKeysSchema();
