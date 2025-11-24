export { };
const ROUTER_API_URL = process.env.API_URL || 'http://localhost:3000';

const TEST_CASES = [
    { prompt: "Hello, how are you?", expected: "fast" },
    { prompt: "What is the capital of France?", expected: "fast" },
    { prompt: "Write a Python function to calculate Fibonacci numbers.", expected: "balanced" },
    { prompt: "Analyze the financial implications of the merger between Company A and B given the current interest rates.", expected: "reasoning" },
    { prompt: "Optimize this O(n^2) sorting algorithm to O(n log n).", expected: "reasoning" }
];

async function runVerification() {
    console.log('🧠 Starting Model Router Verification...');
    console.log(`Target: ${ROUTER_API_URL}`);

    let passed = 0;

    for (const test of TEST_CASES) {
        console.log(`\nTesting: "${test.prompt.substring(0, 40)}..."`);

        const res = await fetch(`${ROUTER_API_URL}/api/router/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: test.prompt })
        });

        if (!res.ok) {
            console.error('❌ Request Failed');
            process.exit(1);
        }

        const data = await res.json();
        console.log(`  -> Routed to: \x1b[36m${data.tier}\x1b[0m (${data.model})`);
        console.log(`  -> Reason: ${data.reason}`);

        if (data.tier === test.expected) {
            console.log('  ✅ Correct');
            passed++;
        } else {
            console.warn(`  ⚠️ Expected ${test.expected}, got ${data.tier}`);
        }
    }

    console.log(`\n✨ Verification Complete: ${passed}/${TEST_CASES.length} passed.`);
}

runVerification().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
