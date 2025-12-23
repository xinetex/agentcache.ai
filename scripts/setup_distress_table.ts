
import { db } from '../src/db/client.js';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🛠️ Creating agent_alerts table...');
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS agent_alerts (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_name text,
                severity text NOT NULL,
                message text NOT NULL,
                context jsonb,
                status text DEFAULT 'open',
                created_at timestamp DEFAULT now(),
                resolved_at timestamp
            );
        `);
        console.log('✅ Table agent_alerts created/verified.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Failed to create table:', e);
        process.exit(1);
    }
}

main();
