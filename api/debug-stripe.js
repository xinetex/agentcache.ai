import Stripe from 'stripe';

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Check environment variables
        const checks = {
            stripe_secret_key: !!process.env.STRIPE_SECRET_KEY,
            stripe_secret_key_starts_with: process.env.STRIPE_SECRET_KEY?.substring(0, 7) || 'NOT_SET',
            node_env: process.env.NODE_ENV || 'NOT_SET',
            stripe_installed: false
        };

        // Try to initialize Stripe
        try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
            checks.stripe_installed = true;
            checks.stripe_version = stripe.VERSION;
        } catch (e) {
            checks.stripe_error = e.message;
        }

        res.status(200).json({
            status: 'debug',
            timestamp: new Date().toISOString(),
            checks
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}
