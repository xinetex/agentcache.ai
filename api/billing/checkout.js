
import Stripe from 'stripe';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // Lazy init
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripe = stripeKey ? new Stripe(stripeKey) : null;

    try {
        const { priceId, successUrl, cancelUrl, customerEmail } = await req.json();

        // 🟢 SAAS MODE: Validating request
        if (!process.env.STRIPE_SECRET_KEY) {
            console.warn("⚠️ Stripe Key missing. Using SIMULATION MODE.");
            return new Response(JSON.stringify({ url: successUrl + '?mock_success=true' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId || 'price_H5ggYJDqNy98tK', // Default Pro Plan
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
        });

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error("Stripe Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
