import { Hono } from 'hono';
import { TrustBrokerService } from '../../services/trust-broker.js';

export const truthRouter = new Hono();
const broker = new TrustBrokerService();

// Mock database of verifications (In-memory for MVP)
const verificationLog: any[] = [];

// GET /stats - Recent verifications and stats
truthRouter.get('/stats', async (c) => {
    return c.json({
        total_verified: verificationLog.length,
        truth_score: 98.5, // Mock global trust score
        recent_claims: verificationLog.slice(-10).reverse()
    });
});

// POST /verify - Manually verify a claim
truthRouter.post('/verify', async (c) => {
    const { claim } = await c.req.json();
    if (!claim) return c.json({ error: 'Claim required' }, 400);

    try {
        // Use TrustBroker to verify
        // Note: In MVP, we might mock this or use the actual OpenAI call if env vars are set
        // const result = await broker.verifyClaim(claim); 

        // Mock result for UI development speed if no API key
        const result = {
            claim,
            verdict: Math.random() > 0.3 ? 'TRUE' : 'FALSE',
            confidence: 0.9 + (Math.random() * 0.09),
            sources: ['Reuters', 'Bloomber', 'On-Chain Data'],
            timestamp: new Date().toISOString()
        };

        verificationLog.push(result);
        return c.json(result);
    } catch (e) {
        return c.json({ error: 'Verification failed' }, 500);
    }
});
