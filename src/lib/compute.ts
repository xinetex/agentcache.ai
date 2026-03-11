/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { inngest } from "../inngest/client.js";

type ComputeTarget = 'folding' | 'risk' | 'motion';

interface ComputePayload {
    input: any;
    priority?: 'high' | 'normal' | 'background';
    meta?: Record<string, any>;
}

/**
 * Compute Interface
 * The standard way to request "Heavy Compute" from the AgentCache network.
 * Decouples the Service (API) from the Worker (GPU/Cluster).
 */
export const Compute = {

    /**
     * Dispatch a heavy task to the background worker swarm.
     */
    dispatch: async (target: ComputeTarget, payload: ComputePayload) => {
        console.log(`[Compute] Dispatching ${target} task to grid...`);

        await inngest.send({
            name: "compute/job.submitted",
            data: {
                target,
                input: payload.input,
                meta: payload.meta || {},
                timestamp: Date.now()
            },
        });

        return {
            status: 'queued',
            jobId: `job_${target}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        };
    }
};
