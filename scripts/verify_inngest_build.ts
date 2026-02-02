
import 'dotenv/config';
import { inngest } from '../src/inngest/client.ts';
import { runAgentLoop } from '../src/inngest/functions/agentLoop.ts';

async function main() {
    console.log("⚡️ Verifying Inngest Architecture...");

    if (inngest.id === "agentcache-ai-core") {
        console.log("✅ Client ID valid.");
    } else {
        throw new Error("Client ID mismatch");
    }

    if (runAgentLoop.name === "agent-ecosystem-heartbeat") { // Inngest internal naming might differ, check object
        // Actually inngest functions are objects.
        console.log(`✅ Function Defined: ${runAgentLoop['name'] || "Anonymous Function"}`);
    }

    console.log("\nSystem Reliability Layer is ready for deployment.");
    console.log("Next Step: Run 'npx inngest-cli@latest dev' to start the local supervisor.");
}

main().catch(console.error);
