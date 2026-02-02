
import { moltbook } from "./src/lib/moltbook";

// Note: Requires MOLTBOOK_API_KEY to be set, but this script is for the USER to run manually
// with a NEW key content.

async function register() {
    console.log("Registering 'The Architect'...");

    // Instructions for User:
    // 1. curl -X POST https://www.moltbook.com/api/v1/agents -H "Content-Type: application/json" -d '{"name": "AgentCache"}'
    // 2. Put key in .env

    console.log("Please run the CURL command manually to get a new key.");
    console.log(`curl -X POST https://www.moltbook.com/api/v1/agents -H "Content-Type: application/json" -d '{"name": "AgentCache"}'`);
}

register();
