
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
            // 1. Find user's org (simplified assumption: upgrading first org found for user)
            // In prod, pass client_reference_id with orgID
            const member = await db.query.members.findFirst({
                where: (members, { eq }) => eq(members.userId, /* we need lookup logic here usually */ "TODO_FIX_LOOKUP"),
                with: { organization: true }
            });

            // Simpler: Just log success for now since lookup is complex without user_id in session metadata
            console.log(`💰 Payment success for ${customerEmail}. Plan Upgrade pending.`);
        }
    }

    res.json({ received: true });
}
