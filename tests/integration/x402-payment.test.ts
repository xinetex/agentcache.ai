import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/ArmorService.js', () => ({
    ArmorService: class {
        async checkRequest() {
            return { allowed: true };
        }
    },
}));

let app: any;

const apiKey = 'ac_demo_test_x402'; // Not a real demo key, should fail

async function request(path: string, body?: Record<string, unknown>, headers: Record<string, string> = {}) {
    const response = await app.request(path, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    let payload;
    try {
        payload = await response.json();
    } catch (e) { /* ignore */ }

    return { response, payload };
}

describe.sequential('x402 Agentic Payment Protocol', () => {
    beforeAll(async () => {
        ({ app } = await import('../../src/index.js'));
    });

    it('returns x402 headers on 402 Payment Required for unfunded agents', async () => {
        const createHash = (await import('crypto')).createHash;
        const keyHash = createHash('sha256').update(apiKey).digest('hex');
        const now = new Date();
        const monthKey = `usage:${keyHash}:m:${now.toISOString().slice(0, 7)}`;

        // Artificially saturate the free tier quota (10,000)
        const { redis } = await import('../../src/lib/redis.js');
        await redis.set(monthKey, '10000');

        const lastResponse = await request('/api/ontology/map', {
            sourceData: "Test",
            targetSchema: { type: "object" }
        }, { 'X-API-Key': apiKey });

        // It should immediately hit the 402 Payment Required
        expect(lastResponse.response.status).toBe(402);

        // Ensure the JSON response is still intact for humans
        expect(lastResponse.payload.code).toBe('CREDITS_REQUIRED');
        expect(lastResponse.payload.topoff_url).toBe('/topoff');

        // Ensure x402 headers are attached for agents
        expect(lastResponse.response.headers.get('Pay-Uris')).toBe('base:0xAgentCacheMasterWallet');
        expect(lastResponse.response.headers.get('Pay-Network')).toBe('base-mainnet');
        expect(lastResponse.response.headers.get('Pay-Amount')).toBe('0.01');
    }, 15000);

    it('allows agent access instantly if Preauthorization is provided (x402 payment success)', async () => {
        // Now hit it with the mock preauthorization header as if the agent successfully paid 0.01 USDC
        const res = await request('/api/ontology/map', {
            sourceData: "Test",
            targetSchema: { type: "object" }
        }, {
            'X-API-Key': apiKey,
            'Preauthorization': '0xABC123MockHash'
        });

        // The request shouldn't be blocked by Auth anymore
        // It might return 200, or a different error like 400 depending on mock setup, 
        // but it should NOT return 401 or 402.
        expect(res.response.status).not.toBe(401);
        expect(res.response.status).not.toBe(402);
    });
});
