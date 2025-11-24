import { inngest } from "../client.js";

export const backgroundSwarm = inngest.createFunction(
    { id: "background-swarm" },
    { event: "agent/swarm.start" },
    async ({ event, step }) => {
        const { sessionId, task, model } = event.data;

        // Step 1: Research (Simulated)
        const research = await step.run("research-topic", async () => {
            // In a real app, this would call a Search Tool or LLM
            await new Promise(resolve => setTimeout(resolve, 1000));
            return `Research findings for: ${task}`;
        });

        // Step 2: Draft Content
        const draft = await step.run("draft-content", async () => {
            return `Draft content based on: ${research}`;
        });

        // Step 3: Finalize
        const final = await step.run("finalize-output", async () => {
            return `Final Report: ${draft} (Model: ${model})`;
        });

        return { body: final };
    }
);
