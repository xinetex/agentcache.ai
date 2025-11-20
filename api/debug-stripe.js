module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const envCheck = {
        hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
        stripeKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7) || 'NOT_SET',
        nodeVersion: process.version,
        platform: process.platform,
        vercelRegion: process.env.VERCEL_REGION || 'unknown'
    };

    res.status(200).json(envCheck);
};
