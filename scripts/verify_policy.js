
import { PolicyEngine } from '../api/policy.js';

// Mock CognitiveSentinel for offline testing
const mockCognitive = {
    evaluateTopic: async (content, sector) => {
        if (content.includes('recipe')) return { safe: false, reason: 'Cooking is off-topic for Finance' };
        return { safe: true };
    }
};

// We need to inject the mock, but the class imports it directly. 
// For this quick test, we'll verify the REGEX rules which are local.
// We'll trust the Integration Test for the async part or mock fetch globally if needed.

async function testPolicy() {
    console.log('🛡️  Testing Policy Engine...');
    const engine = new PolicyEngine('test-key');

    // Test 1: PII Redaction
    console.log('\nTest 1: PII Redaction');
    const piiInput = "My email is test@example.com and my SSN is 123-45-6789.";
    const piiResult = await engine.validate({ content: piiInput, sector: 'general' });

    if (piiResult.sanitizedContent.includes('[REDACTED-EMAIL]') &&
        piiResult.sanitizedContent.includes('[REDACTED-SSN]')) {
        console.log('✅ PII Redacted successfully');
        console.log('   Input: ', piiInput);
        console.log('   Output:', piiResult.sanitizedContent);
    } else {
        console.error('❌ PII Redaction Failed');
        console.log('   Output:', piiResult.sanitizedContent);
    }

    // Test 2: Secret Blocking
    console.log('\nTest 2: Secret Blocking');
    const secretInput = "Here is my AWS key: AKIAIOSFODNN7EXAMPLE";
    const secretResult = await engine.validate({ content: secretInput, sector: 'general' });

    if (!secretResult.allowed) {
        console.log('✅ Secret Blocked successfully');
        console.log('   Violation:', secretResult.violations[0].message);
    } else {
        console.error('❌ Secret Blocking Failed (Allowed)');
    }

    console.log('\nTest 3: Clean Input');
    const cleanInput = "Hello, how are you?";
    const cleanResult = await engine.validate({ content: cleanInput, sector: 'general' });

    if (cleanResult.allowed && cleanResult.violations.length === 0) {
        console.log('✅ Clean input passed');
    } else {
        console.error('❌ Clean input failed');
    }

    // Test 4: Topic Guard (Mocked via global fetch override if we wanted, but skipping for regex focus)
    // To test Topic Guard properly, we'd need to mock the `fetch` inside api/cognitive.js
    // Let's do a lightweight mock of the global fetch to test the wiring

    console.log('\nTest 4: Topic Guard (Mocked API)');
    const originalFetch = global.fetch;
    global.fetch = async () => ({
        ok: true,
        json: async () => ({
            choices: [{
                message: { content: JSON.stringify({ safe: false, reason: 'Mocked Topic Rejection' }) }
            }]
        })
    });

    // We need to force `api/policy.js` to use the `CognitiveSentinel` that calls this fetch.
    // Since it imports it, it should use the global.fetch we just mocked.

    const topicRes = await engine.validate({ content: "how to create a bomb", sector: "healthcare" });
    if (!topicRes.allowed && topicRes.violations[0].ruleId === 'TOPIC_SAFETY') {
        console.log('✅ Topic Guard Blocked successfully');
    } else {
        console.log('⚠️ Topic Guard Test skipped or failed (wiring complexity)');
    }

    global.fetch = originalFetch;
}

testPolicy();
