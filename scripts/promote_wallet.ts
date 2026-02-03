
import 'dotenv/config';
import { db } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { eq, or } from 'drizzle-orm';

async function promoteUser() {
    const identifier = process.argv[2]; // Email or Wallet Address
    const role = process.argv[3] || 'admin';
    const plan = process.argv[4] || 'enterprise';

    if (!identifier) {
        console.error("Usage: npx tsx scripts/promote_wallet.ts <email_or_wallet> [role] [plan]");
        process.exit(1);
    }

    console.log(`🔍 Looking for user: ${identifier}`);

    try {
        // Find user by email OR wallet_address
        const [user] = await db.select()
            .from(users)
            .where(or(eq(users.email, identifier), eq(users.walletAddress, identifier)))
            .limit(1);

        if (!user) {
            console.error("❌ User not found. Have they logged in yet?");
            process.exit(1);
        }

        console.log(`👤 Found User: ${user.id} (${user.email || user.walletAddress})`);
        console.log(`   Current Role: ${user.role}, Plan: ${user.plan}`);

        // Update
        await db.update(users)
            .set({
                role,
                plan,
                updatedAt: new Date()
            })
            .where(eq(users.id, user.id));

        console.log(`✅ User Promoted to Role: '${role}' and Plan: '${plan}'`);

    } catch (e) {
        console.error("❌ Error promoting user:", e);
    }
    process.exit(0);
}

promoteUser();
