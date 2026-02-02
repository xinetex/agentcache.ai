
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("❌ DATABASE_URL is missing!");
        process.exit(1);
    }

    const sqlPath = path.resolve('scripts/deploy_marketplace.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    console.log(`Connecting to DB: ${dbUrl.split('@')[1]}...`); // Mask credentials
    const sql = postgres(dbUrl, { ssl: 'require' });

    try {
        console.log("🚀 Executing Migration...");
        // Split by double newline to roughly isolate blocks, or just run whole thing.
        // Postgres.js can mostly handle multi-statement if simple.
        // But safer to execute as one block if supported, or wrapped in transaction.

        await sql.begin(async sql => {
            await sql.unsafe(sqlContent);
        });

        console.log("✅ Migration Successful! New tables created.");
    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        await sql.end();
    }
}

main();
