import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function listTables() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(res.rows.map(r => r.table_name).join('\n'));
    await client.end();
}

listTables().catch(console.error);
