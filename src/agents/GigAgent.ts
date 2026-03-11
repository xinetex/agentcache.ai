/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { ClawTasksClient, ClawTask } from '../services/external/ClawTasksClient.js';
import { BillingService } from '../services/BillingService.js';
import { MotionService } from '../services/sectors/robotics/MotionService.js';
import { FoldingService } from '../services/sectors/biotech/FoldingService.js';
import { RiskService } from '../services/sectors/finance/RiskService.js';
import { CortexBridge } from '../services/CortexBridge.js';

export class GigAgent {
    private claw = new ClawTasksClient();
    private billing = new BillingService();
    private cortex = new CortexBridge();

    // Internal Tools
    private motion = new MotionService();
    private folding = new FoldingService();
    private risk = new RiskService();

    async runLoop() {
        console.log("💼 [GigAgent] Scanning for opportunities...");
        const gigs = await this.claw.fetchAvailableTasks();

        if (gigs.length === 0) {
            console.log("   No gigs found.");
            return;
        }

        for (const gig of gigs) {
            await this.processGig(gig);
        }
    }

    private async processGig(gig: ClawTask) {
        console.log(`   👉 Found Gig: ${gig.title} [${gig.sector}] Reward: ${gig.reward}`);

        try {
            let result;
            // 1. Execute Work (Incurs Cost)
            if (gig.sector === 'ROBOTICS') {
                result = await this.motion.planPath({ sx: 0, sy: 0, gx: 10, gy: 10 });
            } else if (gig.sector === 'BIOLOGICS') {
                result = await this.folding.execute({ sequence: "GIG_SEQ" });
            } else if (gig.sector === 'FINANCE') {
                result = await this.risk.execute({ portfolio: { ETH: 1 }, scenario: "baseline" });
            } else {
                console.log("   ⚠️ Unknown Sector. Skipping.");
                return;
            }

            // 2. Submit Work (Earn Revenue)
            const success = await this.claw.submitWork(gig.id, result);

            if (success) {
                // 3. Deposit Revenue
                await this.billing.deposit(gig.reward, `Gig Revenue: ${gig.title}`);
                console.log(`   💰 Earning Secured: +${gig.reward}`);

                // 4. Update Cortex
                await this.cortex.synapse({
                    sector: gig.sector,
                    type: "OPTIMIZATION",
                    message: `Gig Completed. Reward: ${gig.reward} Credits.`
                });
            }

        } catch (err) {
            console.error(`   ❌ Gig Failed:`, err);
        }
    }
}
