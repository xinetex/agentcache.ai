
import 'dotenv/config';
import fs from 'fs';
import pg from 'pg';
import path from 'path';

const { Client } = pg;

const MIGRATION_FILE = process.argv[2];

if (!MIGRATION_FILE) {
    console.error('Please provide a migration file path argument.');
    process.exit(1);
}

async function run() {
    console.log('Connecting to DB...');
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found in environment');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected.');

        const sqlPath = path.resolve(MIGRATION_FILE);
        if (!fs.existsSync(sqlPath)) {
            console.error(`Migration file not found at ${sqlPath}`);
            process.exit(1);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Running SQL from ${path.basename(sqlPath)}...`);

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
