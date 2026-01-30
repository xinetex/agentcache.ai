
import Stripe from 'stripe';
import { db } from '../../src/db/client';
import { organizations, members } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { buffer } from 'micro';

export const config = {
    api: {
        bodyParser: false, // Required for Stripe signature verification
    },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    // 🟢 SAAS MODE: Simulation check
    if (!process.env.STRIPE_SECRET_KEY) {
        console.warn("⚠️ Stripe implementation missing. Skipping webhook.");
        return res.status(200).json({ received: true, simulated: true });
    }

    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerEmail = session.customer_email || session.customer_details?.email;

        if (customerEmail) {
            // Upgrade Org to Pro
            // 1. Find user by email (webhook carries customer_email)
            const users = await db.query.users.findMany({
                where: (users, { eq }) => eq(users.email, customerEmail),
                limit: 1
            });

            if (users.length > 0) {
                const user = users[0];

                // 2. Find their organization (assuming primary/first org for now)
                const membersList = await db.query.members.findMany({
                    where: (members, { eq }) => eq(members.userId, user.id),
                    with: { organization: true },
                    limit: 1
                });

                if (membersList.length > 0) {
                    const org = membersList[0].organization;

                    // 3. Update Organization Tier
                    await db.update(organizations)
                        .set({
                            tier: 'pro',
                            planPeriodEnd: new Date(session.expires_at * 1000 || Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days if not sub
                        })
                        .where(eq(organizations.id, org.id));

                    console.log(`✅ Organization ${org.id} upgraded to PRO for user ${customerEmail}`);
                } else {
                    console.error(`❌ User ${customerEmail} found but has no organization.`);
                }
            } else {
                console.error(`❌ Payment received for ${customerEmail} but user not found in DB.`);
            }
        }
    }

    res.json({ received: true });
}
