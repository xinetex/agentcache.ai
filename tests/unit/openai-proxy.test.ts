import { describe, it, expect, vi } from 'vitest';
import { app } from '../../src/index.js';

// We mock ONLY LLMFactory to prevent live LLM calls. 
// SemanticCacheService will use the local redis mock automatically in vitest.
vi.mock('../../src/lib/llm/factory.js', () => {
    return {
        LLMFactory: {
            createProvider: vi.fn().mockReturnValue({
                chat: vi.fn().mockResolvedValue({
                    content: 'Mocked Live API Response',
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
                })
            })
        }
    };
});

vi.mock('../../src/services/ArmorService.js', () => {
    const mock = {
        checkRequest: async () => ({ allowed: true }),
        checkSettlementVelocity: async () => ({ allowed: true })
    };
    return {
        ArmorService: class {
            checkRequest = mock.checkRequest;
            checkSettlementVelocity = mock.checkSettlementVelocity;
        },
        armorService: mock
    };
});

describe('OpenAI-compatible Proxy endpoint', () => {

    it('should call factory and cache on cache MISS', async () => {
        const uniquePrompt = 'Unique query ' + Date.now();
        const res = await app.request('/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'ac_demo_test123'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3-opus',
                messages: [{ role: 'user', content: uniquePrompt }],
                temperature: 0.5
            })
        });

        const text = await res.text();
        if (res.status !== 200) console.error("Error from proxy:", text);

        expect(res.status).toBe(200);
        const json = JSON.parse(text);
        expect(json.object).toBe('chat.completion');
        expect(json.choices[0].message.content).toBe('Mocked Live API Response');
        expect(json.model).toBe('anthropic/claude-3-opus');
    });

    it('should return a 200 formatted like an OpenAI response on cache HIT', async () => {
        // Send exact same request to trigger semantic/exact cache hit.
        const cachedPrompt = 'Repeated query ' + Date.now();
        
        // 1. Prime the cache
        await app.request('/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'ac_demo_test123'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3-opus',
                messages: [{ role: 'user', content: cachedPrompt }]
            })
        });

        // 2. Fetch the cache (should hit)
        const resHit = await app.request('/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'ac_demo_test123'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3-opus',
                messages: [{ role: 'user', content: cachedPrompt }]
            })
        });

        const text = await resHit.text();
        expect(resHit.status).toBe(200);
        const json = JSON.parse(text);
        expect(json.object).toBe('chat.completion');
        expect(json.choices[0].message.content).toBe('Mocked Live API Response');
        expect(json.id).toBeDefined();
    });
});
