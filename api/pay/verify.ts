import { SolanaService } from '../../src/services/SolanaService.js';
import { notifier } from '../../src/services/NotificationService.js';
import { db } from '../../src/db/client.js';
import { users, organizations, members, creditTransactions } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');
    const amount = url.searchParams.get('amount');
    const userId = url.searchParams.get('userId');

    if (!reference || !amount) {
        return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
    }

    try {
        const amountNum = parseFloat(amount);
        const isConfirmed = await SolanaService.verifyPayment(reference, amountNum);

        if (isConfirmed && userId) {
            // --- Fulfillment Logic ---
            console.log(`[Solana] Fulfilling payment of ${amountNum} SOL for user ${userId}`);

            // 1. Get User & Org
            const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
            if (user.length > 0) {
                // Determine Plan based on amount (roughly)
                // 0.05 SOL = Test/Credits, 1.0 SOL = Pro (Fleet), 5.0 SOL = Enterprise (Cluster)
                let targetPlan = user[0].plan || 'free';
                let messagePrefix = 'Payment Received';
                
                if (amountNum >= 4.9) {
                    targetPlan = 'enterprise';
                } else if (amountNum >= 0.9) {
                    targetPlan = 'pro';
                }

                // Update User Plan
                if (targetPlan !== user[0].plan) {
                    await db.update(users).set({ plan: targetPlan }).where(eq(users.id, userId));
                    
                    // Update Org plan if member
                    const member = await db.select().from(members).where(eq(members.userId, userId)).limit(1);
                    if (member.length > 0) {
                        await db.update(organizations).set({ plan: targetPlan }).where(eq(organizations.id, member[0].orgId));
                    }
                    
                    messagePrefix = `Upgraded to ${targetPlan === 'enterprise' ? 'Cognitive Cluster' : 'Swarm Fleet'}`;
                }

                // Add Credits Anyway (Incentive)
                const creditsToAdd = Math.floor(amountNum * 10000); // 10K credits per 1 SOL (Roughly $100 value)
                await db.insert(creditTransactions).values({
                    id: uuidv4(),
                    userId: userId,
                    type: 'deposit',
                    amount: creditsToAdd,
                    balanceAfter: 0, // Simplified for MVP
                    description: `Solana Payment (${amount} SOL): ${reference}`
                });

                // Send Notification
                await notifier.send(
                    userId,
                    'success',
                    messagePrefix,
                    `Successfully verified ${amount} SOL. Your account has been updated.`,
                    '/billing'
                );
            }
        }

        return new Response(JSON.stringify({
            status: isConfirmed ? 'confirmed' : 'pending'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('[Solana Verify] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
