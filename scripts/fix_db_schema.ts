
import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';

async function fixSchema() {
    console.log("🔧 Patching Database Schema Columns...");

    try {
        // Ensure tables exist first (basic)
        await db.execute(sql`CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text unique);`);
        await db.execute(sql`CREATE TABLE IF NOT EXISTS organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);`);

        // Patch Users
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`);
        console.log("   ✅ Patched 'users' columns");

        // Patch Organizations
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';`);
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS region text DEFAULT 'us-east-1';`);
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();`);
        console.log("   ✅ Patched 'organizations' columns");

        // Ensure Members
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS members (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id uuid REFERENCES organizations(id),
                user_id uuid REFERENCES users(id),
                role text DEFAULT 'viewer',
                joined_at timestamp DEFAULT now()
            );
        `);

        // Ensure API Keys
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS api_keys (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id uuid REFERENCES organizations(id),
                prefix text NOT NULL,
                hash text NOT NULL,
                scopes text[],
                last_used_at timestamp,
                created_at timestamp DEFAULT now(),
                expires_at timestamp
            );
        `);

        console.log("✨ Schema Columns Synced.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Patch failed:", e);
        process.exit(1);
    }
}

fixSchema();
