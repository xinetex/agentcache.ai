import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
    console.log('Adding settings column to users table...');
    try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';`;
        console.log('DONE!');
    } catch (e) {
        console.error(e);
    }
}

run();
