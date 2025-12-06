// Native fetch is available in Node > 18
const API_URL = 'http://localhost:3000/api/cache';

// Test Scenarios: Semantically similar but textually different
const SCENARIOS = [
    {
        topic: "Physics",
        queries: [
            "Explain the theory of relativity",
            "What is Einstein's theory of relativity?", // Semantic Match
            "Define relativity in physics" // Semantic Match
        ]
    },
    {
        topic: "Coding",
        queries: [
            "How do I center a div in CSS?",
            "CSS center div flexbox", // Semantic Match
            "Center an element horizontally and vertically css" // Semantic Match
        ]
    },
    {
        topic: "History",
        queries: [
            "Who was the first president of the USA?",
            "First US president name", // Semantic Match
            "George Washington role" // Semantic Match
        ]
    }
];

async function checkCache(query: string) {
    const payload = {
        provider: 'openai',
        model: 'gpt-4',
        messages: [{ role: 'user', content: query }],
        temperature: 0.7,
        semantic: true // Enable Semantic Caching
    };

    const start = Date.now();
    try {
        const res = await fetch(`${API_URL}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        const latency = Date.now() - start;
        return { ...data, latency };
    } catch (err) {
        console.error("API Error:", err);
        return { error: true };
    }
}

async function setCache(query: string, response: string) {
    try {
        await fetch(`${API_URL}/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'openai',
                model: 'gpt-4',
                messages: [{ role: 'user', content: query }],
                temperature: 0.7,
                response: response
            })
        });
        // Allow vector indexing to catch up
        await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
        console.error("Set Error:", err);
    }
}

async function runMonitor() {
    console.log("🚀 Starting Synthetic Cache Monitor...");
    console.log("----------------------------------------");

    for (const scenario of SCENARIOS) {
        console.log(`\nTesting Topic: ${scenario.topic}`);

        // 1. Prime the Cache (First Query)
        const primeQuery = scenario.queries[0];
        console.log(`[Prime] Query: "${primeQuery}"`);

        // Check first - should be MISS
        let res = await checkCache(primeQuery);
        if (!res.cached) {
            console.log(`   -> MISS (Expected). Setting cache...`);
            await setCache(primeQuery, `Simulated answer for ${primeQuery} [${Date.now()}]`);
        } else {
            console.log(`   -> HIT (Already cached).`);
        }

        // 2. Test Semantic Hits
        for (let i = 1; i < scenario.queries.length; i++) {
            const testQuery = scenario.queries[i];
            console.log(`[Test] Query: "${testQuery}"`);

            res = await checkCache(testQuery);

            if (res.cached) {
                const type = res.type === 'semantic' ? '🧠 SEMANTIC HIT' : '🎯 EXACT HIT';
                console.log(`   -> ${type} | Similarity: ${res.similarity?.toFixed(4) || '1.0'} | Latency: ${res.latency}ms`);
            } else {
                console.log(`   -> ❌ MISS | Latency: ${res.latency}ms (Silent Failure?)`);
            }

            // Artificial delay to visualize "pulses" in UI
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log("\n✅ Monitor Cycle Complete.");
}

// Run loop
setInterval(runMonitor, 30000); // Run every 30s to keep the dashboard alive
runMonitor();
