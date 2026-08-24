import { serve } from "inngest/edge";
import { inngest } from "../src/inngest/client.js";
import { backgroundSwarm } from "../src/inngest/functions/swarm.js";
import { agentRun } from "../src/inngest/functions/agent-run.js";

export const config = { runtime: "edge" };

export default serve({
    client: inngest,
    functions: [backgroundSwarm, agentRun],
});
