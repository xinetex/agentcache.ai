/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { Hono } from 'hono';
import { BillingService } from '../../services/BillingService.js';

const treasuryRouter = new Hono();
const billing = new BillingService();

treasuryRouter.get('/status', async (c) => {
    try {
        const balance = await billing.getBalance();
        const ledger = await billing.getLedger();

        return c.json({
            balance,
            ledger,
            currency: 'AC_CREDITS'
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// Admin Top-Up Endpoint
treasuryRouter.post('/deposit', async (c) => {
    try {
        const body = await c.req.json();
        await billing.deposit(body.amount, "Admin Deposit");
        return c.json({ success: true, new_balance: await billing.getBalance() });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { treasuryRouter };
