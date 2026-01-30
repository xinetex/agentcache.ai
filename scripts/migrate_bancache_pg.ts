
import postgres from 'postgres';
import 'dotenv/config';

async function migrate() {
    if (!process.env.DATABASE_URL) throw new Error("No DATABASE_URL");

    const sql = postgres(process.env.DATABASE_URL);

    console.log('🛡️ Applying safe partial migration for Bancache (PG Driver)...');

    try {
        await sql`
            CREATE TABLE IF NOT EXISTS "bancache" (
                "hash" text PRIMARY KEY NOT NULL,
                "banner_text" text NOT NULL,
                "first_seen_at" timestamp DEFAULT now(),
                "last_seen_at" timestamp DEFAULT now(),
                "seen_count" integer DEFAULT 1
            );
        `;
        console.log('✅ Created table: bancache');

        await sql`
            CREATE TABLE IF NOT EXISTS "banner_analysis" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "banner_hash" text,
                "agent_model" text NOT NULL,
                "risk_score" real,
                "classification" text,
                "vulnerabilities" jsonb,
                "compliance" jsonb,
                "reasoning" text,
                "analyzed_at" timestamp DEFAULT now()
            );
        `;
        console.log('✅ Created table: banner_analysis');

        // Add FK
        await sql`
            DO $$ BEGIN
                ALTER TABLE "banner_analysis" ADD CONSTRAINT "banner_analysis_banner_hash_bancache_hash_fk" FOREIGN KEY ("banner_hash") REFERENCES "public"."bancache"("hash") ON DELETE no action ON UPDATE no action;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `;
        console.log('✅ Added FK constraints');

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await sql.end();
    }
}

migrate();
