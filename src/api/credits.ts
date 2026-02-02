import { Hono } from 'hono';
import { billing } from '../lib/payment/billing.js';
import { authenticateApiKey } from '../middleware/auth.js';

const app = new Hono();

/**
 * GET /balance
 * Returns the current credit balance for the authenticated user/org.
 */
app.get('/balance', async (c) => {
    // 1. Auth Check
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    // 2. Get User Context
    // In a real app, we'd map API Key -> Org -> Stripe Customer ID
    // For MVP/Demo, we use a mock Customer ID or pull from the token
    const stripesCustomerId = 'cus_mock_123';

    const balanceCents = await billing.getBalance(stripesCustomerId);

    // Stripe Balance: Negative = Credit (User has paid us in advance)
    // Positive = Due (User owes us)
    // We want to display "Available Credits", so we invert the negative balance.
    const availableCredit = balanceCents < 0 ? Math.abs(balanceCents) / 100 : 0;

    return c.json({
        balance: availableCredit,
        currency: 'USD',
        formatted: `$${availableCredit.toFixed(2)}`,
        status: availableCredit > 0 ? 'active' : 'empty'
    });
});

/**
 * POST /top-off
 * Create a checkout session to add credits
 */
app.post('/top-off', async (c) => {
    // Stub for future implementation
    return c.json({ message: "Top-off endpoint ready for logic" });
});

export default app;
