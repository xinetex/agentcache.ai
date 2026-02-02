
import { GrowthAgent } from '../src/agents/GrowthAgent.js';
import process from 'process';

console.log("-----------------------------------------");
console.log("  AGENTCACHE ECOSYSTEM FLYWHEEL ACTIVATION");
console.log("-----------------------------------------");

const agent = new GrowthAgent();

(async () => {
    try {
        await agent.runCampaign();

        console.log("-----------------------------------------");
        console.log("STATUS: Campaign Active");
        console.log("METRICS: Moltbook Signals Broadcasting...");
        console.log("METRICS: ClawTasks Bounties Filled...");
        process.exit(0);
    } catch (error) {
        console.error("Flywheel Stalled:", error);
        process.exit(1);
    }
})();
