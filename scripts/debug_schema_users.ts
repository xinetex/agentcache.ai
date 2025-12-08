
import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';

async function checkUsersSchema() {
    console.log("🔍 Checking 'users' table schema...");
    try {
        const columns = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);

        console.log("\n📋 Columns found:");
        columns.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

        const hasHash = columns.some(c => c.column_name === 'password_hash');
        const hasRole = columns.some(c => c.column_name === 'role');
        const hasPlan = columns.some(c => c.column_name === 'plan');

        console.log("\n✅ Verification:");
        console.log(`   password_hash: ${hasHash ? 'OK' : 'MISSING ❌'}`);
        console.log(`   role:          ${hasRole ? 'OK' : 'MISSING ❌'}`);
        console.log(`   plan:          ${hasPlan ? 'OK' : 'MISSING ❌'}`);

        if (!hasHash || !hasRole || !hasPlan) {
            console.log("\n⚠️  Schema mismatch detected! Fix required.");
        } else {
            console.log("\n✨ Schema matches Login API requirements.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

checkUsersSchema();
