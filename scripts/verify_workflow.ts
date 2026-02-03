
// Verify Workflow Engine execution

async function main() {
    console.log("⚙️  Verifying Workflow Engine...");

    const runHandler = (await import('../api/pipelines/run.ts')).default;

    // Mock Request
    const req = {
        method: 'POST',
        headers: {
            get: () => 'Bearer demo'
        },
        json: async () => ({
            steps: [
                { id: 'v1', name: 'Verify Step 1', action: 'search', params: { query: 'test' } },
                { id: 'v2', name: 'Verify Step 2', action: 'audit', params: {} }
            ]
        })
    };

    try {
        // @ts-ignore
        const res = await runHandler(req);
        const data = await res.json();

        console.log("   Status:", data.status);
        console.log("   Run ID:", data.runId);
        console.log("   Logs:", data.logs.length, "entries");

        if (data.success && data.status === 'completed') {
            console.log("   ✅ Workflow executed successfully.");
        } else {
            console.error("   ❌ Workflow failed or incomplete:", data);
        }

    } catch (e) {
        console.error("   ❌ Workflow Error:", e);
    }
}

main();
