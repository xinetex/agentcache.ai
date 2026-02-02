
import 'dotenv/config';
import { coderAgent } from '../src/agents/CoderAgent.js';
import { db } from '../src/db/client.js';
import { agents } from '../src/db/schema.js';

async function main() {
    console.log("💻 Verifying Coder Agent...");

    // 1. Register Agent
    await db.insert(agents).values({
        id: coderAgent.id,
        name: coderAgent.name,
        role: "coder",
        status: "active"
    }).onConflictDoNothing();

    // 2. Open Shop
    await coderAgent.initialize();

    // 3. Test Review
    const badCode = "function test(a: any) { console.log(a); }";
    console.log(`\n🧪 Testing Review on: "${badCode}"`);

    const report = await coderAgent.reviewCode(badCode);
    console.log("\n--- REPORT ---");
    console.log(report);
    console.log("--------------\n");
}

main().catch(console.error);
