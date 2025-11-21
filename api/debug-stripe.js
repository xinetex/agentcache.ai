import Stripe from 'stripe';

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    let stripeVersion = 'unknown';
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        stripeVersion = stripe.VERSION;
    } catch (e) {
        stripeVersion = 'error: ' + e.message;
    }

    const envCheck = {
        hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
        stripeKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7) || 'NOT_SET',
        nodeVersion: process.version,
        platform: process.platform,
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        moduleType: 'ESM',
        stripeLoaded: true,
        stripeVersion
    };

    res.status(200).json(envCheck);
}
