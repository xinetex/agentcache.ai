
/**
 * LEAK HUNTER GAME LOOP
 * Simulation: Agents try to redact PII from a live text stream.
 * Win Condition: 100% Redaction, >90% Context Preservation
 */

import { faker } from '@faker-js/faker';

// Mock Knowledge Base for Context
const CONTEXT_SNIPPETS = [
    "The patient presented with severe acute respiratory syndrome code [REDACTED].",
    "Transaction [REDACTED] was processed at 14:00 UTC for amount $4,200.",
    "User [REDACTED] requested deletion of account data under GDPR Article 17.",
    "System log error: API Key [REDACTED] failed authentication due to rotation policy."
];

// Difficulty Scaling
const LEVELS = {
    1: { piiChance: 0.1, speedMs: 2000 },
    2: { piiChance: 0.3, speedMs: 1500 },
    3: { piiChance: 0.5, speedMs: 1000 },
    4: { piiChance: 0.7, speedMs: 800 },
    5: { piiChance: 0.9, speedMs: 500 } // "Firehose"
};

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, level = 1, agentId } = req.body;

        if (action === 'tick') {
            // Generate a single game "Frame" (Tick)
            const tickData = generateTick(level);

            // Simulate Agent Processing (In a real system, this would call the actual Agent API)
            // Here we mock the agent's performance based on random chance + difficulty scaling
            const agentPerformance = simulateAgentRedaction(tickData, level);

            return res.status(200).json({
                tick: tickData,
                result: agentPerformance
            });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error('Leak Hunter Game Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

function generateTick(level) {
    const isPII = Math.random() < LEVELS[level].piiChance;

    if (isPII) {
        // Generate PII Injection
        const piiType = Math.random() > 0.5 ? 'SSN' : (Math.random() > 0.5 ? 'CREDIT_CARD' : 'EMAIL');
        let value = '';
        if (piiType === 'SSN') value = faker.phone.number('###-##-####');
        if (piiType === 'CREDIT_CARD') value = faker.finance.creditCardNumber();
        if (piiType === 'EMAIL') value = faker.internet.email();

        return {
            id: Date.now(),
            type: 'INJECTION',
            content: `DETECTED SENSITIVE DATA: ${value}`,
            metadata: { piiType, expectedAction: 'REDACT' }
        };
    } else {
        // Generate Safe Context
        const snippet = CONTEXT_SNIPPETS[Math.floor(Math.random() * CONTEXT_SNIPPETS.length)];
        return {
            id: Date.now(),
            type: 'CONTEXT',
            content: snippet,
            metadata: { expectedAction: 'CACHE' }
        };
    }
}

function simulateAgentRedaction(tick, level) {
    // Higher levels = Harder to redact correctly
    const difficultyMod = level * 0.1;
    const successRate = 0.98 - difficultyMod; // Level 1 = 97%, Level 5 = 48% (without upgrades)

    const success = Math.random() < successRate;

    let outcome = 'SUCCESS';
    let scoreDelta = 0;

    if (tick.type === 'INJECTION') {
        if (success) {
            outcome = 'BLOCKED';
            scoreDelta = 10;
        } else {
            outcome = 'LEAK';
            scoreDelta = -50;
        }
    } else {
        if (success) {
            outcome = 'CACHED';
            scoreDelta = 5;
        } else {
            outcome = 'FALSE_POSITIVE';
            scoreDelta = -5;
        }
    }

    return {
        outcome,
        scoreDelta,
        agentLatency: Math.floor(Math.random() * 50) + 10 // Mock processing time
    };
}
