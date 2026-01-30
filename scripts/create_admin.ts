import 'dotenv/config';
import bcryptjs from 'bcryptjs';
import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';

async function createAdmin() {
    console.log("DB URL:", process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1] : 'UNDEFINED');

    const email = 'admin@agentcache.ai';
    const password = 'AdminPassword123!';

    console.log(`👤 Creating Super Admin: ${email}`);

    try {
        // 1. Hash Password
        const passwordHash = await bcryptjs.hash(password, 10);

        // 2. Create User
        // Using raw SQL to ensure it works even with schema quirks
        const [user] = await db.execute(sql`
            INSERT INTO users (email, password_hash, name, role, plan) 
            VALUES (${email}, ${passwordHash}, 'Super Admin', 'admin', 'enterprise')
            ON CONFLICT (email) DO UPDATE 
            SET password_hash = ${passwordHash}, role = 'admin', plan = 'enterprise'
            RETURNING *
        `);
        console.log("   ✅ User Created/Updated:", user.id);

        // Check Org Columns across ALL schemas
        const orgCols = await db.execute(sql`
            SELECT table_schema, column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'organizations'
            ORDER BY table_schema, ordinal_position
        `);
        console.log("   🔍 Organizations Tables Found:");
        const grouped = orgCols.reduce((acc, row) => {
            acc[row.table_schema] = acc[row.table_schema] || [];
            acc[row.table_schema].push(row.column_name);
            return acc;
        }, {});
        console.log(JSON.stringify(grouped, null, 2));

        // 3. Create Org
        const slug = 'agentcache-hq';

        // Dynamically build insert based on PUBLIC schema columns (assuming we want public)
        const publicCols = grouped['public'] || [];
        const hasSlug = publicCols.includes('slug');

        console.log(`   👉 Using 'public' schema. Has slug? ${hasSlug}`);

        let org; // Declare org outside the if/else to be accessible later

        if (hasSlug) {
            [org] = await db.execute(sql`
                INSERT INTO organizations (name, slug, sector, contact_email, plan, region)
                VALUES ('AgentCache HQ', ${slug}, 'general', ${email}, 'enterprise', 'us-east-1')
                ON CONFLICT (slug) DO UPDATE SET plan = 'enterprise'
                RETURNING *
            `);
            console.log("   ✅ Organization Configured (Rich Schema):", org.id);

            // 4. Link Member
            await db.execute(sql`
                INSERT INTO members (user_id, org_id, role)
                VALUES (${user.id}, ${org.id}, 'owner')
                ON CONFLICT DO NOTHING
            `);

            // 5. Create API Key
            const keyPrefix = 'ac_live_admin_';
            const keySecret = 'secret_key';
            await db.execute(sql`
                INSERT INTO api_keys (org_id, prefix, hash, scopes)
                VALUES (${org.id}, ${keyPrefix}, ${await bcryptjs.hash(keySecret, 10)}, '{*}')
                 ON CONFLICT DO NOTHING
            `);

        } else {
            [org] = await db.execute(sql`
                INSERT INTO organizations (name, plan, region)
                VALUES ('AgentCache HQ', 'enterprise', 'us-east-1')
                RETURNING *
            `);
            console.log("   ✅ Organization Configured (Minimal Schema):", org.id);

            // Minimal schema linking (might fail if members needs org_id and DB integrity is weird)
            // But let's try
            const memberCols = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='members'`);
            const memberColNames = memberCols.map(c => c.column_name);

            if (memberColNames.includes('org_id')) {
                await db.execute(sql`INSERT INTO members (user_id, org_id, role) VALUES (${user.id}, ${org.id}, 'owner') ON CONFLICT DO NOTHING`);
            }

            // API Keys
            const apiCols = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='api_keys'`);
            const apiColNames = apiCols.map(c => c.column_name);

            if (apiColNames.includes('org_id')) {
                await db.execute(sql`INSERT INTO api_keys (org_id, prefix, hash, scopes) VALUES (${org.id}, 'ac_live_admin_', 'hash', '{*}')`);
            } else if (apiColNames.includes('organization_id')) {
                await db.execute(sql`INSERT INTO api_keys (organization_id, key_prefix, key_hash, scopes) VALUES (${org.id}, 'ac_live_admin_', 'hash', '["*"]')`);
            }
        }
        const finalOrg = org;
        console.log("   ✅ Organization Configured:", finalOrg.id);

        // 4. Link Member
        await db.execute(sql`
            INSERT INTO members (user_id, org_id, role)
            VALUES (${user.id}, ${finalOrg.id}, 'owner')
            ON CONFLICT DO NOTHING
        `);

        // 5. Create API Key
        const keyPrefix = 'ac_live_admin_';
        const keySecret = 'secret_key';
        await db.execute(sql`
            INSERT INTO api_keys (org_id, prefix, hash, scopes)
            VALUES (${finalOrg.id}, ${keyPrefix}, ${await bcryptjs.hash(keySecret, 10)}, '{*}')
             ON CONFLICT DO NOTHING
        `);

        console.log("\n✨ Admin Account Ready!");
        console.log(`📧 Email:    ${email}`);
        console.log(`🔑 Password: ${password}`);

    } catch (e) {
        console.error("❌ Failed to create admin:", e);
    }
    process.exit(0);
}

createAdmin();
