/**
 * verify_sector_solutions.ts
 * Verifies Phase 8: Sector-Specific Sentient Solutions.
 */

import { sectorSolutionOrchestrator } from '../src/services/SectorSolutionOrchestrator.js';
import { soulRegistry } from '../src/services/SoulRegistry.js';
import { agentRegistry } from '../src/lib/hub/registry.js';

async function verify() {
    console.log("--- 🪐 Phase 8: Sector-Specific Sentient Solutions Verification ---");

    const sectors: ('FINTECH' | 'BIOTECH')[] = ['FINTECH', 'BIOTECH'];

    for (const sector of sectors) {
        console.log(`[Step 1] Spawning ${sector} sentient solution...`);
        const solution = await sectorSolutionOrchestrator.spawnSectorAgent(sector);

        console.log(`✅ Solution Agent: ${solution.name}`);
        console.log(`   AgentID:     ${solution.agentId}`);
        console.log(`   First Axiom: ${solution.axioms[0]}`);

        // Verify 1: Hub Presence
        const profile = await agentRegistry.getById(solution.agentId);
        if (profile && profile.domain.includes(sector.toLowerCase())) {
            console.log(`✅ Hub Registry profile confirmed for ${sector}.`);
        } else {
            console.error(`❌ Profile for ${sector} not found or incorrect.`);
            process.exit(1);
        }

        // Verify 2: Soul Ledger
        const ledger = await soulRegistry.getLedgerForAgent(solution.agentId);
        if (ledger.length > 0) {
            console.log(`✅ Soul Ledger active for ${solution.name} (${ledger.length} markers).`);
        } else {
            console.error(`❌ Soul Ledger missing for ${solution.name}.`);
            process.exit(1);
        }
    }

    // Verify 3: Multi-sector stats
    const active = await sectorSolutionOrchestrator.getActiveSolutions();
    console.log(`[Step 2] Total active sector solutions: ${active.length}`);
    if (active.length >= 2) {
        console.log("✅ Multi-sector scaling confirmed.");
    } else {
        console.error("❌ Stats mismatch.");
        process.exit(1);
    }

    console.log("\n--- 🛡️ Phase 8 Verification COMPLETE: Sector Solution Atlas is ALIVE ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
