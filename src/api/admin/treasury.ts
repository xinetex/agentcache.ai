import { Hono } from 'hono';
import { billing } from '../../lib/payment/billing.js';
import { wallet } from '../../lib/payment/wallet.js';
import { authenticateApiKey } from '../../middleware/auth.js';
import { redis } from '../../lib/redis.js';

const app = new Hono();

// Auth Middleware (Optional override for Admin)
// app.use('*', authMiddleware);

/**
 * GET /stats
 * Returns aggregated financial data for the Treasury Panel
 */
app.get('/stats', async (c) => {
    // 1. Stripe Balance (Fiat Treasury)
    // In a real app, this would be the Platform Account Balance
    // For now, we fetch a mock customer balance or system balance
    const stripeBalanceCents = await billing.getBalance('cus_system_treasury');
    const stripeBalanceUSD = stripeBalanceCents / 100;

    // 2. Solana Balance (Crypto Treasury)
    let solanaBalance = 0;
    let walletAddress = '';
    try {
        solanaBalance = await wallet.getBalance();
        walletAddress = wallet.getAddress();
    } catch (e) {
        console.warn('Failed to fetch Solana balance', e);
    }

    // 3. Transactions (Redis Seeded)
    const logs = await redis.lrange('treasury:log', 0, 19);
    const recentTx = logs.map(l => JSON.parse(l));

    return c.json({
        fiat: {
            balance: stripeBalanceUSD,
            currency: 'USD',
            status: 'connected'
        },
        crypto: {
            balance: solanaBalance,
            currency: 'SOL',
            address: walletAddress,
            status: 'active'
        },
        transactions: recentTx
    });
});

export default app;
