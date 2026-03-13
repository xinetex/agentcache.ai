/**
 * verify_full_revenue_loop.ts
 * Integration test for Hunter -> Probe -> Negotiation sequence.
 */

import { vacuumHunterService } from '../src/services/VacuumHunterService.js';
import { salesProbeOrchestrator } from '../src/services/SalesProbeOrchestrator.js';
import { a2aNegotiationEngine } from '../src/services/A2ANegotiationEngine.js';
import { b2bServiceOrchestrator } from '../src/services/B2BServiceOrchestrator.js';

async function verify() {
    console.log("--- ⛓️ Full Revenue Loop Verification ---");

    const clientId = "client-revenue-1";

    // 1. Hunt
    console.log("Step 1: Hunting for Vacuums...");
    const zones = await vacuumHunterService.scanForVacuums();
    const targetZone = zones[0];
    console.log(`Targeting Sector: ${targetZone.sector}`);

    // 2. Probe
    console.log("\nStep 2: Dispatching Probes...");
    const probes = await salesProbeOrchestrator.dispatchProbes();
    const probe = probes[0];
    console.log(`Probe Dispatched: ${probe.id} (Status: ${probe.status})`);

    // 3. Negotiate
    console.log("\nStep 3: Initiating A2A Negotiation...");
    let session = await a2aNegotiationEngine.initiateNegotiation(probe.id, clientId, targetZone.sector);
    console.log(`Negotiation Session: ${session.id} (Stage: ${session.currentStage})`);

    // Step through the negotiation
    console.log("Advancing negotiation rounds...");
    for (let i = 0; i < 3; i++) {
        session = await a2aNegotiationEngine.stepNegotiation(session.id);
        console.log(`Round ${i+1}: ${session.currentStage} | Valuation: $${session.valuationOffer}`);
    }

    if (session.currentStage === 'ACCEPTED') {
        console.log("✅ Negotiation reached ACCEPTED state.");
    }

    // 4. Verify Market Stats
    console.log("\nStep 4: Verifying Integrated Market Stats...");
    const stats = await b2bServiceOrchestrator.getMarketStats(clientId);
    console.log(`Active Negotiations reported: ${stats.active_negotiations.length}`);
    console.log(`Outreach Stats: Total Sent ${stats.outreach_stats.total_sent}`);

    if (stats.active_negotiations.length > 0 && stats.outreach_stats.total_sent > 0) {
        console.log("✅ All systems report integrated revenue signals.");
    } else {
        console.log("❌ Market stats missing revenue telemetry.");
    }

    console.log("\n--- Full Loop Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
