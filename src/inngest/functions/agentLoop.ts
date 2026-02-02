
import { inngest } from "../client";
import { growthAgent } from "../../agents/GrowthAgent.js";

/**
 * The Heartbeat of the Economy.
 * Runs every 10 minutes to maximize autonomy while managing costs.
 */
export const runAgentLoop = inngest.createFunction(
    { id: "agent-ecosystem-heartbeat" },
    { cron: "*/10 * * * *" }, // Cron Schedule
    async ({ step, event, logger }) => {

        logger.info("💓 Heartbeat started. Waking up agents...");

        // Step 1: Growth Agent Cycle
        const trends = await step.run("growth-agent-scan", async () => {
            logger.info("📈 GrowthAgent scanning Moltbook...");
            // We invoke the logic directly (assuming it's stateless enough or uses DB)
            // Ideally GrowthAgent should be refactored to be purely functional, 
            // but for now we wrap the class method.
            try {
                await growthAgent.runCycle();
                return { status: "success" };
            } catch (err) {
                logger.error("GrowthAgent failed:", err);
                throw err; // Trigger retry
            }
        });

        // Step 2: (Future) Researcher checks queue
        // await step.run("researcher-check", async () => { ... });

        logger.info("💤 Heartbeat complete. Agents sleeping.");
        return { trends };
    }
);
