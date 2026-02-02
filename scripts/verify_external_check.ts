
import { growthAgent } from '../src/agents/GrowthAgent.js';

async function main() {
    console.log("🔍 Testing External Bounty Scraper...");
    const results = await growthAgent.checkExternalBounties();
    console.log("Results:", results);
}

main();
