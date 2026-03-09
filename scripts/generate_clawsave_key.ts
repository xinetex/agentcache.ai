
import 'dotenv/config';
import { db } from '../src/db/client.js';
import { sql } from 'drizzle-orm';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';

async function generateKey() {
    console.log("🔐 Generating API Key for ClawSave...");

    const orgName = "ClawSave";

    // 1. Find or Create Organization
    let orgId;

    // Check if org exists by name
    const orgs = await db.execute(sql`SELECT id, name FROM organizations WHERE name = ${orgName} LIMIT 1`);

    if (orgs.length > 0) {
        orgId = orgs[0].id;
        console.log(`   ✅ Organization found: ${orgName} (${orgId})`);
    } else {
        console.log(`   ✨ Creating organization: ${orgName}`);

        // Dynamic column check
        const cols = await db.execute(sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'organizations'
        `);
        const colNames = cols.map(c => c.column_name);

        const hasSlug = colNames.includes('slug');
        const hasSector = colNames.includes('sector');
        const hasContactEmail = colNames.includes('contact_email');
        const hasPlan = colNames.includes('plan');
        const hasRegion = colNames.includes('region');

        // Construct query
        const fields = ['name'];
        const values = [orgName];
        const placeholders = ['${orgName}']; // Only for logging/debugging manual check, actual SQL uses params

        // We use execute directly with template literal logic carefully or just conditional logic
        // Drizzle sql`` is easier if we just write the whole query or use conditional parts

        if (hasSlug && hasSector) {
            console.log("   👉 Using rich schema insert (slug, sector, etc)");
            // Assuming contact_email is also there if sector is there, but let's check
            if (hasContactEmail) {
                const result = await db.execute(sql`
                    INSERT INTO organizations (name, slug, plan, region, sector, contact_email)
                    VALUES (${orgName}, 'clawsave', 'enterprise', 'us-east-1', 'general', 'clawsave@agentcache.ai')
                    RETURNING id
                `);
                orgId = result[0].id;
            } else {
                const result = await db.execute(sql`
                    INSERT INTO organizations (name, slug, plan, region, sector)
                    VALUES (${orgName}, 'clawsave', 'enterprise', 'us-east-1', 'general')
                    RETURNING id
                `);
                orgId = result[0].id;
            }
        } else if (hasSlug) {
            console.log("   👉 Using semi-rich schema insert (slug only)");
            const result = await db.execute(sql`
                INSERT INTO organizations (name, slug, plan, region)
                VALUES (${orgName}, 'clawsave', 'enterprise', 'us-east-1')
                RETURNING id
            `);
            orgId = result[0].id;
        } else {
            console.log("   👉 Using minimal schema insert");
            // If sector is required but not slug? Unlikely based on error, but handling generic case:
            if (hasSector) {
                const result = await db.execute(sql`
                    INSERT INTO organizations (name, plan, region, sector)
                    VALUES (${orgName}, 'enterprise', 'us-east-1', 'general')
                    RETURNING id
                `);
                orgId = result[0].id;
            } else {
                const result = await db.execute(sql`
                    INSERT INTO organizations (name, plan, region)
                    VALUES (${orgName}, 'enterprise', 'us-east-1')
                    RETURNING id
                `);
                orgId = result[0].id;
            }
        }
        console.log(`   ✅ Organization created: ${orgId}`);
    }

    // 2. Generate Key
    const prefix = 'ac_live_clawsave_';
    const secretPart = crypto.randomBytes(24).toString('hex');
    const fullKey = `${prefix}${secretPart}`;

    // 3. Hash Key
    const hashedKey = await bcryptjs.hash(secretPart, 10);

    console.log(`   🔑 Key Generated: ${fullKey}`);

    // 4. Insert into DB
    const apiCols = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='api_keys'`);
    const apiColNames = apiCols.map(c => c.column_name);

    if (apiColNames.includes('org_id')) {
        await db.execute(sql`
            INSERT INTO api_keys (org_id, prefix, hash, scopes, name)
            VALUES (${orgId}, ${prefix}, ${hashedKey}, '{*}', 'ClawSave Primary Key')
        `);
    } else if (apiColNames.includes('organization_id')) {
        await db.execute(sql`
            INSERT INTO api_keys (organization_id, key_prefix, key_hash, scopes, name)
            VALUES (${orgId}, ${prefix}, ${hashedKey}, '["*"]', 'ClawSave Primary Key')
        `);
    } else {
        throw new Error("Could not find org_id or organization_id in api_keys table");
    }

    console.log("   ✅ API Key saved to database.");
    console.log("\n👇 COPY THIS KEY NOW (It won't be shown again):");
    console.log(`\n    AGENTCACHE_API_KEY="${fullKey}"\n`);

    process.exit(0);
}

generateKey().catch(e => {
    console.error("❌ Error:", e);
    process.exit(1);
});
