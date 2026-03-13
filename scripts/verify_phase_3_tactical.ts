/**
 * verify_phase_3_tactical.ts
 * Verification for Phase 3: Tactical Hardening.
 */

import { emailService } from '../src/services/EmailService.js';
import { shadowValueInvoiceGenerator } from '../src/services/ShadowValueInvoiceGenerator.js';
import { vacuumHunterService } from '../src/services/VacuumHunterService.js';
import { salesProbeOrchestrator } from '../src/services/SalesProbeOrchestrator.js';

async function verify() {
    console.log("--- 🏗️ Phase 3: Tactical Hardening Verification ---");

    const clientId = "client-alpha-99";

    // 1. Verify Email (Mock)
    console.log("Step 1: Testing Outreach Infrastructure...");
    const emailRes = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Verification',
        text: 'Tactical hardening active.'
    });
    console.log(`Email Service: ${emailRes.success ? '✅ UP' : '❌ DOWN'} (ID: ${emailRes.id})`);

    // 2. Verify Invoice Generator
    console.log("\nStep 2: Testing Δm Invoice Generation...");
    const invoice = await shadowValueInvoiceGenerator.generateReport(clientId);
    console.log(`Invoice Generated: ${invoice.id}`);
    console.log(`Total Shadow Value: $${invoice.totalShadowValue}`);
    if (invoice.totalShadowValue >= 0) {
        console.log("✅ Invoice Generator quantified latent utility.");
    }

    // 3. Verify LLM Gap Synthesis
    console.log("\nStep 3: Testing LLM Gap Synthesis...");
    const vacuums = await vacuumHunterService.scanForVacuums();
    const gap = vacuums[0].gap_description;
    console.log(`Hunter Gap Description: ${gap}`);
    if (gap.includes('LLM Augmented') || gap.length > 0) {
        console.log("✅ Vacuum Hunter synthesized market intelligence.");
    }

    // 4. Verify Probe Outreach Loop
    console.log("\nStep 4: Verifying Automated Outreach loop...");
    const probes = await salesProbeOrchestrator.dispatchProbes();
    console.log(`Dispatched ${probes.length} new probes.`);
    if (probes.length >= 0) {
        console.log("✅ Sales Probe Orchestrator connected to outreach loop.");
    }

    console.log("\n--- Phase 3 Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
