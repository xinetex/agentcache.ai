
import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function listUsers() {
    console.log("👥 Listing Users...");

    try {
        const users = await db.execute(sql`
            SELECT id, email, role, plan, password_hash IS NOT NULL as has_password 
            FROM users
        `);
        console.table(users);
    } catch (e) {
        console.error("❌ Failed to list users:", e);
    }
    process.exit(0);
}

listUsers();
