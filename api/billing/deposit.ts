
import { redis } from '../../src/lib/redis.js'; // Ensure extension for ESM
import { createHash } from 'crypto';

export const config = { runtime: 'nodejs' };

/**
 * POST /api/billing/deposit
 * Mocks a Stripe Deposit
 */
export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // Auth
    const apiKey = req.headers.get('x-api-key');
    let userId;

    // Simple Auth Logic (matches list.ts)
    if (apiKey && apiKey.startsWith('ac_')) {
        userId = createHash('sha256').update(apiKey).digest('hex');
    } else {
        // Fallback for mocked FE flow that sends Bearer token
        const auth = req.headers.get('authorization');
        if (auth) userId = 'user_' + createHash('md5').update(auth).digest('hex'); // consistent mock id
    }

    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    try {
        const body = await req.json();
        const amount = parseFloat(body.amount);

        if (isNaN(amount) || amount <= 0) {
            return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400 });
        }

        // --- MOCK STRIPE CHARGE ---
        const txId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        // --------------------------

        // Crediting Ledger (Redis)
        // Key: billing:account:{id}:balance
        const balanceKey = `billing:account:${userId}:balance`;
        const newBalance = await redis.incrbyfloat(balanceKey, amount);

        // Log Transaction (Optional, for history)
        const historyKey = `billing:account:${userId}:history`;
        const txRecord = {
            id: txId,
            amount: amount,
            type: 'deposit',
            status: 'completed',
            timestamp: Date.now()
        };
        await redis.lpush(historyKey, JSON.stringify(txRecord));

        return new Response(JSON.stringify({
            success: true,
            balance: newBalance,
            txId: txId
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
