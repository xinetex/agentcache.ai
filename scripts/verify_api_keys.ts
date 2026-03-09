
import { db } from '../src/db/client.js';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function verifyKeys() {
    console.log("🗝️ Verifying API Keys Table...");

    try {
        // 1. Get an existing Org ID (or fake one)
        const orgs = await db.execute(sql`SELECT id FROM organizations LIMIT 1`);
        const orgId = orgs.length > 0 ? orgs[0].id : '00000000-0000-0000-0000-000000000000'; // Fake UUID if empty

        console.log("Using Org ID:", orgId);

        // 2. Attempt Insert
        // Trying explicit array cast
        await db.execute(sql`
            INSERT INTO api_keys (org_id, prefix, hash, scopes)
            VALUES (${orgId}, 'test_', 'hash', ${['read', 'write']})
        `);
        console.log("✅ Insert Success with array");

    } catch (e) {
        console.error("❌ Insert Failed:", e);
    }
    process.exit(0);
}

verifyKeys();
