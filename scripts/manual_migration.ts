
import { neon } from '@neondatabase/serverless';

async function main() {
    console.log("🛠️ Running Manual Migration...");

    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL is missing");
        process.exit(1);
    }

    const sql = neon(process.env.DATABASE_URL);

    try {
        console.log("Adding wallet_address to users...");
        await sql`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS wallet_address TEXT UNIQUE,
            ADD COLUMN IF NOT EXISTS nonce TEXT;
        `;

        console.log("Making email and password nullable...");
        await sql`
            ALTER TABLE users 
            ALTER COLUMN email DROP NOT NULL,
            ALTER COLUMN password_hash DROP NOT NULL;
        `;
        console.log("✅ Migration Successful.");
    } catch (e) {
        console.error("❌ Migration Failed:", e);
    }
}

main().catch(console.error);
