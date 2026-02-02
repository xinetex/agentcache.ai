import { Hono } from 'hono';
import { billing } from '../../lib/payment/billing.js';
import { wallet } from '../../lib/payment/wallet.js';
import { authenticateApiKey } from '../../middleware/auth.js';

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

    // 3. Transactions (Mocked Stream for MVP)
    const recentTx = [
        { id: 'tx_1', type: 'stripe_in', amount: 29.00, desc: 'Pro Subscription', time: Date.now() - 100000 },
        { id: 'tx_2', type: 'sol_out', amount: -0.05, desc: 'Agent Gas Fee', time: Date.now() - 500000 },
        { id: 'tx_3', type: 'stripe_usage', amount: 5.20, desc: 'Top-off Credits', time: Date.now() - 2000000 },
        { id: 'tx_4', type: 'sol_in', amount: 0.10, desc: 'Service Fee', time: Date.now() - 3600000 },
    ];

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
