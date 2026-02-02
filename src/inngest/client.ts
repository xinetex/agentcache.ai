
import { Inngest } from "inngest";
import { schemas } from "./types"; // We will define types next

/**
 * Inngest Client
 * Orchestrates reliable, durable execution of Agent workflows.
 */
export const inngest = new Inngest({
    id: "agentcache-ai-core",
    schemas
});
