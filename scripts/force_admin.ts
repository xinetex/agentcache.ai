
import bcryptjs from 'bcryptjs';
import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function forceAdmin() {
    console.log("🛠️  Forcing Schema Sync & Admin Creation...");

    try {
        // 1. Force Column Existence (Idempotent)
        console.log("   👉 Patching 'organizations'...");
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug text`);
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sector text DEFAULT 'general'`);
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email text`);
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free'`);

        // Ensure Unique Constraint for ON CONFLICT
        try {
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON organizations (slug)`);
        } catch (e) { console.log("   ⚠️ Index creation note:", e.message); }

        console.log("   👉 Patching 'api_keys'...");
        await db.execute(sql`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id uuid`);
        await db.execute(sql`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix text`);
        await db.execute(sql`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash text`);
        // Note: scopes might be text[] or json depending on history. We won't alter type here riskily.

        // 2. Create Admin User
        const email = 'admin@agentcache.ai';
        const password = 'AdminPassword123!';
        const passwordHash = await bcryptjs.hash(password, 10);

        console.log(`   👤 Creating User: ${email}`);

        const [user] = await db.execute(sql`
            INSERT INTO users (email, password_hash, name, role, plan) 
            VALUES (${email}, ${passwordHash}, 'Super Admin', 'admin', 'enterprise')
            ON CONFLICT (email) DO UPDATE 
            SET password_hash = ${passwordHash}, role = 'admin', plan = 'enterprise'
            RETURNING *
        `);

        // 3. Create Org
        const slug = 'agentcache-hq';
        console.log(`   Mw Creating Org: ${slug}`);

        const [org] = await db.execute(sql`
            INSERT INTO organizations (name, slug, sector, contact_email, plan, region)
            VALUES ('AgentCache HQ', ${slug}, 'general', ${email}, 'enterprise', 'us-east-1')
            ON CONFLICT (slug) DO UPDATE SET plan = 'enterprise'
            RETURNING *
        `);

        // 4. Link Member
        await db.execute(sql`
            INSERT INTO members (user_id, org_id, role)
            VALUES (${user.id}, ${org.id}, 'owner')
            ON CONFLICT DO NOTHING
        `);

        // 5. Create API Key
        // Attempt using valid columns detected earlier (organization_id)
        const keyPrefix = 'ac_live_admin_';
        const keySecret = 'secret_key';

        // Try insert with organization_id (preferred)
        try {
            await db.execute(sql`
                INSERT INTO api_keys (organization_id, key_prefix, key_hash, scopes)
                VALUES (${org.id}, ${keyPrefix}, ${await bcryptjs.hash(keySecret, 10)}, ${JSON.stringify(['*'])})
             `);
        } catch (e) {
            // Fallback to org_id if schema is stubborn
            console.log("   ⚠️  Retrying API Key with 'org_id'...");
            await db.execute(sql`
                INSERT INTO api_keys (org_id, prefix, hash, scopes)
                VALUES (${org.id}, ${keyPrefix}, ${await bcryptjs.hash(keySecret, 10)}, '{*}')
             `);
        }

        console.log("\n✅ SUPER ADMIN RESTORED");
        console.log(`   Email: ${email}`);
        console.log(`   Pass:  ${password}`);

    } catch (e) {
        console.error("❌ Force Admin Failed:", e);
    }
    process.exit(0);
}

forceAdmin();
