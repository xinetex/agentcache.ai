
import 'dotenv/config';
import { ledger } from '../src/services/LedgerService.js';
import { marketplace } from '../src/services/MarketplaceService.js';
import { growthAgent } from '../src/agents/GrowthAgent.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * ACTIVATE FLYWHEEL
 * Simulates the autonomous commercial loop of the AgentCache ecosystem.
 */
async function main() {
    console.log("🚀 ACTIVATING ECOSYSTEM FLYWHEEL...\n");

    // 1. Setup the Workforce (The Supply)
    const workerId = uuidv4();
    await ledger.createAccount(workerId, 'agent', 0);

    console.log(`[System] Registered Worker Agent: ${workerId}`);
    await marketplace.createListing(workerId, {
        title: "Deep Lidar Analysis",
        description: "Autonomous structural verification using USGS + Moonshot.",
        price: 5.00,
        unit: 'report'
    });
    console.log(`[System] Worker posted service: "Deep Lidar Analysis" ($5.00)\n`);


    // 2. Setup the Growth Agent (The Demand)
    // Needs funds to operate independently
    await ledger.createAccount(growthAgent.id, 'agent', 100);
    console.log(`[System] Growth Agent Online. Balance: $100.00`);


    // 3. Run the Cycle
    console.log("\n--- STARTING AUTONOMOUS CYCLE ---");
    await growthAgent.runCycle();
    console.log("--- CYCLE COMPLETE ---\n");


    // 4. Verify Economic Impact
    const workerAcc = await ledger.getAccount(workerId);
    const growthAcc = await ledger.getAccount(growthAgent.id);

    console.log(`\n📊 ECONOMIC REPORT:`);
    console.log(`Worker Balance: $${workerAcc.balance} (Earned +$5)`);
    console.log(`Growth Balance: $${growthAcc.balance} (Spent -$5)`);

    if (workerAcc.balance === 5 && growthAcc.balance === 95) {
        console.log("\n✅ FLYWHEEL STATUS: HEALTHY (Value Transferred)");
    } else {
        console.log("\n⚠️ FLYWHEEL STATUS: UNBALANCED");
    }
}

main().catch(console.error);
