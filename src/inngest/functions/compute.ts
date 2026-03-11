/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { inngest } from "../client.js";
import { redis } from "../../lib/redis.js";
import { stableHash } from "../../lib/stable-json.js";

/**
 * The Compute Worker
 * Listens for "Heavy" jobs and executes them (simulated).
 * 
 * In a real deployment, this would be routed to a GPU cluster via queues.
 */
export const computeWorker = inngest.createFunction(
    { id: "compute-worker-swarm" },
    { event: "compute/job.submitted" },
    async ({ event, step }) => {
        const { target, input, meta } = event.data;

        // 1. Acknowledge
        await step.run("log-start", async () => {
            console.log(`[Worker] Received dispatch: ${target}`);
        });

        // 2. Execute Logic (Simulate CPU Burn)
        const result = await step.run("execute-compute", async () => {

            // Artificial Latency based on sector complexity
            let burnTime = 1000;
            if (target === 'folding') burnTime = 5000; // Protein folding is hard
            if (target === 'risk') burnTime = 2000;

            await new Promise(resolve => setTimeout(resolve, burnTime));

            // Generate deterministic result based on input
            const hash = stableHash(input);

            return {
                data: `PROCESSED_${target.toUpperCase()}_${hash}`,
                compute_time_ms: burnTime,
                gpu_node: "A100-CLUSTER-04"
            };
        });

        // 3. Crystallize (Cache It)
        await step.run("crystallize-result", async () => {
            // In reality, we'd store this back in Redis where the API is polling for it
            const key = `compute:result:${target}:${stableHash(input)}`;
            await redis.setex(key, 3600, JSON.stringify(result));
        });

        return { status: "completed", output: result };
    }
);
