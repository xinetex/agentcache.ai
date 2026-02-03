
import { randomBytes } from 'crypto';
const MOCKED_TOKEN = "ac_" + randomBytes(16).toString('hex');
const BASE_URL = 'http://localhost:3000'; // Assuming running locally, or we mock the request objects

async function main() {
    console.log("🪙  Verifying Monetization & Coder Agent...");

    // 1. Verify Coder Agent Initialization (Listing Services)
    console.log("\n1️⃣  Initializing Coder Agent...");
    try {
        const { coderAgent } = await import('../src/agents/CoderAgent.ts');
        await coderAgent.initialize();
        console.log("   ✅ Coder Agent Initialized.");
    } catch (e) {
        console.error("   ❌ Failed to init Coder Agent:", e);
    }

    // 2. Mock Deposit
    console.log("\n2️⃣  Testing Deposit API...");

    // We can't fetch localhost easily if server isn't running.
    // So we import the handler directly for unit testing logic.
    const depositHandler = (await import('../api/billing/deposit.ts')).default;

    const mockReq = {
        method: 'POST',
        headers: {
            get: (k) => {
                if (k === 'x-api-key') return MOCKED_TOKEN;
                return null;
            }
        },
        json: async () => ({ amount: 50.00 })
    };

    try {
        // @ts-ignore
        const res = await depositHandler(mockReq);
        const data = await res.json();

        console.log("   Deposit Response:", data);

        if (data.success && data.balance >= 50) {
            console.log("   ✅ Deposit Successful. Balance updated.");
        } else {
            console.error("   ❌ Deposit Failed:", data);
        }

    } catch (e: any) {
        console.error("   ❌ Deposit Error:", e.message);
    }

    // 3. Verify Coder Agent Logic (Mocked LLM)
    console.log("\n3️⃣  Testing Coder Agent Audit...");
    try {
        const { coderAgent } = await import('../src/agents/CoderAgent.ts');

        // Mock the LLM chat to avoid spending tokens during test
        coderAgent.model.chat = async () => ({ content: "# Audit Report\n\nCode looks good." });

        const report = await coderAgent.auditCode("function hello() { console.log('world'); }");

        if (report.includes("Audit Report")) {
            console.log("   ✅ Coder Agent returned report.");
        } else {
            console.error("   ❌ Coder Agent failed to return report.");
        }

    } catch (e) {
        console.error("   ❌ Coder Agent Logic Error:", e);
    }
}

main();
