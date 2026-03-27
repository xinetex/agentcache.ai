/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { describe, it, expect } from 'vitest';
import { PlatonicKeyService } from '../../src/services/PlatonicKeyService.js';

/**
 * Tests the Platonic cross-provider cache hit mechanism directly.
 * 
 * The PlatonicKeyService generates provider-agnostic keys from message content
 * and stores/retrieves cached responses across providers.
 */
describe('PlatonicKeyService — Cross-Provider Cache Hits', () => {
    const platonic = new PlatonicKeyService();

    const testMessages = [
        { role: 'user', content: 'What is the capital of France?' }
    ];

    const testResponse = 'The capital of France is Paris.';

    it('should return null when no Platonic entry exists', async () => {
        const result = await platonic.lookupPlatonic(
            [{ role: 'user', content: 'Something never cached before: ' + Date.now() }],
            0.7
        );
        expect(result).toBeNull();
    });

    it('should store and retrieve a Platonic entry', async () => {
        // Store under openai:gpt-4
        await platonic.storePlatonicShadow({
            messages: testMessages,
            temperature: 0.7,
            response: testResponse,
            provider: 'openai',
            model: 'gpt-4',
        });

        // Retrieve using the same messages (provider-agnostic)
        const result = await platonic.lookupPlatonic(testMessages, 0.7);

        expect(result).not.toBeNull();
        expect(result!.response).toBe(testResponse);
        expect(result!.originalProvider).toBe('openai');
        expect(result!.originalModel).toBe('gpt-4');
    });

    it('should generate the same Platonic key regardless of provider', async () => {
        // The key is derived from messages + temperature, NOT from provider/model
        const key1 = PlatonicKeyService.generatePlatonicKey(testMessages, 0.7);
        const key2 = PlatonicKeyService.generatePlatonicKey(testMessages, 0.7);

        expect(key1).toBe(key2);
        expect(key1).toContain('platonic');
    });

    it('should generate different keys for different messages', async () => {
        const key1 = PlatonicKeyService.generatePlatonicKey(
            [{ role: 'user', content: 'What is the capital of France?' }],
            0.7
        );
        const key2 = PlatonicKeyService.generatePlatonicKey(
            [{ role: 'user', content: 'What is the capital of Germany?' }],
            0.7
        );

        expect(key1).not.toBe(key2);
    });

    it('should serve the same response to any provider asking the same question', async () => {
        // Already stored under openai:gpt-4 from previous test.
        // Any provider can retrieve it because the key is provider-agnostic:
        const result = await platonic.lookupPlatonic(testMessages, 0.7);

        expect(result).not.toBeNull();
        expect(result!.response).toBe('The capital of France is Paris.');
        // The response carries provenance so the caller knows where it came from
        expect(result!.originalProvider).toBe('openai');
        expect(result!.originalModel).toBe('gpt-4');
    });
});
