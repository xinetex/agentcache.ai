
// Verify Chat API logic

async function main() {
    console.log("💬 Verifying Chat API...");

    const chatHandler = (await import('../api/agent/chat.ts')).default;

    // Test 1: Default Agent (OpenAI)
    console.log("\n1️⃣  Testing Default Agent...");
    const req1 = {
        method: 'POST',
        json: async () => ({ message: "Hello default agent", agent: "default" })
    };

    try {
        // @ts-ignore
        const res = await chatHandler(req1);
        const data = await res.json();
        console.log("   Response:", data.message.substring(0, 50) + "...");
    } catch (e) {
        console.error("   ❌ Default Chat Failed:", e);
    }

    // Test 2: Coder Agent (Anthropic)
    console.log("\n2️⃣  Testing Coder Agent...");
    const req2 = {
        method: 'POST',
        json: async () => ({ message: "Review this code: const x = 1;", agent: "coder" })
    };

    try {
        // @ts-ignore
        const res = await chatHandler(req2);
        const data = await res.json();
        console.log("   Response:", data.message.substring(0, 50) + "...");
    } catch (e) {
        console.error("   ❌ Coder Chat Failed:", e);
    }
}

main();
