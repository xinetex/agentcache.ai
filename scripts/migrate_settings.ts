
import { neon } from '@neondatabase/serverless';

async function main() {
    console.log("🛠️ Running Settings Migration...");

    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL is missing");
        process.exit(1);
    }

    const sql = neon(process.env.DATABASE_URL);

    try {
        console.log("Creating user_settings table...");
        await sql`
            CREATE TABLE IF NOT EXISTS user_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL UNIQUE REFERENCES users(id),
                theme_pref TEXT DEFAULT 'system',
                notifications_enabled BOOLEAN DEFAULT true,
                sector_config JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log("✅ Migration Successful.");
    } catch (e) {
        console.error("❌ Migration Failed:", e);
    }
}

main().catch(console.error);
