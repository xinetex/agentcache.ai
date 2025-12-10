
import { db } from '../src/db/client.js';
import { sql } from 'drizzle-orm';

async function checkUser(email: string) {
    console.log(`Checking for user: ${email}...`);
    try {
        const users = await db.execute(sql`
            SELECT id, email, role, plan, created_at 
            FROM users 
            WHERE email = ${email}
        `);

        if (users.length > 0) {
            console.log('✅ User Found:', users[0]);
        } else {
            console.log('❌ User NOT Found');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error querying DB:', err);
        process.exit(1);
    }
}

checkUser('verdoni@gmail.com');
