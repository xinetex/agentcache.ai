
import 'dotenv/config';
import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

async function run() {
    console.log('Connecting to DB...');
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found in environment');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for some hosted Postgres
    }); // Note: Neon usually needs ssl=true or sslmode=require in string

    try {
        await client.connect();
        console.log('Connected.');

        const sqlPath = 'db/migrations/004_qchannel.sql';
        if (!fs.existsSync(sqlPath)) {
            console.error(`Migration file not found at ${sqlPath}`);
            process.exit(1);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Running SQL from ${sqlPath}...`);

        await client.query(sql);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
