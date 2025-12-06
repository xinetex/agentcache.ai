import { CognitiveRouter } from './src/infrastructure/CognitiveRouter.js';

async function runMetacognitionTest() {
    console.log('--- Testing Meta-Cognition (System 1 vs System 2) ---');
    const router = new CognitiveRouter();

    const scenarios = [
        { query: "Hello", expected: 'system_1' },
        { query: "What is the status?", expected: 'system_1' },
        // Complex keywords: "Design", "Architect"
        { query: "Design a fault-tolerant microservices architecture", expected: 'system_2' },
        // Length + Keyword "Explain"
        { query: "Explain the difference between quantum mechanics and general relativity in detail.", expected: 'system_2' },
        // Simple factual (short, no keywords)
        { query: "capital of france", expected: 'system_1' }
    ];

    let passed = 0;

    for (const test of scenarios) {
        process.stdout.write(`Query: "${test.query.substring(0, 40)}..." -> `);
        const route = await router.route(test.query);

        if (route === test.expected) {
            console.log(`✅ ${route.toUpperCase()}`);
            passed++;
        } else {
            console.log(`❌ ${route.toUpperCase()} (Expected: ${test.expected})`);
        }
    }

    if (passed === scenarios.length) {
        console.log('\n✅ All Meta-Cognition Tests Passed.');
    } else {
        console.error(`\n❌ Failed ${scenarios.length - passed} tests.`);
        process.exit(1);
    }
}

runMetacognitionTest();
