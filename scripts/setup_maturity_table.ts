import { db } from '../src/db/client.js';
import { sql } from 'drizzle-orm';

async function setup() {
    console.log("Checking for maturity_ledger table...");
    
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS maturity_ledger (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_id TEXT NOT NULL,
                task_key TEXT NOT NULL,
                success_count INTEGER DEFAULT 0,
                failure_count INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                last_success_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS maturity_agent_task_idx ON maturity_ledger (agent_id, task_key);
        `);
        
        console.log("✅ maturity_ledger table and index verified/created.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to create table:", e);
        process.exit(1);
    }
}

setup();
