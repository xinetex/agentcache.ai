
import 'dotenv/config';
import { db, client } from '../src/db/client.js';
import { lanes } from '../src/db/schema.js';

async function test() {
    console.log('Using DB URL:', process.env.DATABASE_URL ? 'FOUND' : 'MISSING');
    console.log('Connecting...');

    // Set a timeout
    const timer = setTimeout(() => {
        console.error('TIMEOUT: Connection hung for 5s');
        process.exit(1);
    }, 5000);

    try {
        const res = await db.select().from(lanes).limit(1);
        console.log('SUCCESS: Got', res.length, 'lanes');
        clearTimeout(timer);
        await client.end();
        process.exit(0);
    } catch (e) {
        console.error('FAILURE:', e);
        process.exit(1);
    }
}

test();
