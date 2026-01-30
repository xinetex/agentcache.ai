
import { db } from '../src/db/client.js';
import { lanes } from '../src/db/schema.js';

async function main() {
    console.log('Testing DB connection...');
    try {
        const result = await db.select().from(lanes).limit(1);
        console.log('Success:', result);
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

main();
