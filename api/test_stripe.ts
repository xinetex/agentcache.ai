import Stripe from 'stripe';

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req: Request) {
    const key = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!key) {
        return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY missing' }), { status: 500 });
    }

    try {
        const stripe = new Stripe(key);
        return new Response(JSON.stringify({
            status: 'ok',
            hasWebhookSecret: !!webhookSecret
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
