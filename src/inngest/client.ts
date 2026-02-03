
import { Inngest } from "inngest";
import { schemas } from "./types";
import { computeWorker } from "./functions/compute.js";

/**
 * Inngest Client
 * Orchestrates reliable, durable execution of Agent workflows.
 */
export const inngest = new Inngest({
    id: "agentcache-ai-core",
    schemas
});
