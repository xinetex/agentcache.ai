/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { Inngest } from "inngest";
import { schemas } from "./types.js";
import { computeWorker } from "./functions/compute.js";

/**
 * Inngest Client
 * Orchestrates reliable, durable execution of Agent workflows.
 */
export const inngest = new Inngest({
    id: "agentcache-ai-core",
    schemas
});
