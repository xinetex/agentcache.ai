import { inngest } from "../src/inngest/client.js";

async function main() {
    console.log('🐝 Sending Swarm Event...');

    // This tests if the event payload matches the schema (if we defined one, which we haven't strictly yet, but Inngest infers)
    // For now, we just verify the client can send.
    await inngest.send({
        name: "agent/swarm.start",
        data: {
            sessionId: "test-session-123",
            task: "Analyze the impact of quantum computing on cryptography",
            model: "moonshot-v1-128k"
        },
    });

    console.log('✅ Event sent (simulated). In a real app, the Dev Server would pick this up.');
}

main().catch(console.error);
