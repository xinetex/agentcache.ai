
import 'dotenv/config';
import { GigAgent } from '../src/agents/GigAgent.js';
import { BillingService } from '../src/services/BillingService.js';

async function main() {
    const agent = new GigAgent();
    const billing = new BillingService();

    const startBalance = await billing.getBalance();
    console.log(`Start Balance: ${startBalance}`);

    console.log("\n🚀 Activating Gig Agent...");
    await agent.runLoop(); // Run one cycle

    // Give time for async logs
    await new Promise(r => setTimeout(r, 1000));

    const endBalance = await billing.getBalance();
    console.log(`\nEnd Balance: ${endBalance}`);
    console.log(`Net Profit: ${endBalance - startBalance}`);

    if (endBalance > startBalance) {
        console.log("✅ PROFIT CONFIRMED. Flywheel spinning.");
    } else {
        console.log("⚠️ No profit generated (Random RNG or Error). Try again.");
    }
}

main().catch(console.error);
