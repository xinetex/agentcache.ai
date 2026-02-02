
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback
import { researcherAgent } from '../src/agents/ResearcherAgent.js';
import { db } from '../src/db/client.js';
import { agents } from '../src/db/schema.js';

async function main() {
    console.log("🔬 Verifying Researcher Agent...");

    // 1. Register Agent (FK Compliance)
    await db.insert(agents).values({
        id: researcherAgent.id,
        name: researcherAgent.name,
        role: "researcher",
        status: "active"
    }).onConflictDoNothing();

    // 2. Open Shop
    await researcherAgent.initialize();

    // 3. Test Research Capability (if API Key exists)
    if (process.env.PERPLEXITY_API_KEY) {
        console.log("\n🧪 Testing Research Capability...");
        const report = await researcherAgent.performResearch("Latest advancements in Solid State Batteries 2025");
        console.log("\n--- RESULT ---");
        console.log(report.substring(0, 500) + "..."); // Preview
        console.log("--------------\n");
    } else {
        console.warn("⚠️ SKIPPING Research Test: PERPLEXITY_API_KEY missing.");
    }
}

main().catch(console.error);
