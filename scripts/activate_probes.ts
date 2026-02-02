
import 'dotenv/config';
import { ProbeAgent } from '../src/agents/ProbeAgent.js';

async function launch() {
    console.log("🚀 INITIALIZING GLOBAL SALES SWARM...");
    console.log("   - Loading Marketing Assets...");
    console.log("   - Syncing Target Lists...");

    const probe = new ProbeAgent();

    console.log("\n📡 [NETWORK] Probe Agent #442 ONLINE.");
    await probe.runCycle();

    console.log("\n✅ [MISSION] Outreach Complete. Awaiting Leads.");
}

launch().catch(console.error);
