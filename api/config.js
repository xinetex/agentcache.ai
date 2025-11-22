import { URL } from 'url';

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req, res) {
    // Allow CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Return public configuration
    // Fallback to Test IDs if env vars are not set (for backward compatibility/sandbox)
    const prices = {
        starter: process.env.STRIPE_PRICE_STARTER || 'price_1SW7YGAjvdndXr9TJRcqH0KK',
        pro: process.env.STRIPE_PRICE_PRO || 'price_1SW7YHAjvdndXr9TfNQ3C8ct',
        business: process.env.STRIPE_PRICE_BUSINESS || 'price_1SW7YHAjvdndXr9TXD41MUq8'
    };

    res.status(200).json({
        prices,
        mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test'
    });
}
