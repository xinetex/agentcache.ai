
/**
 * AgentCache Heartbeat Worker
 * Triggers the Growth Flywheel periodically.
 */
export default {
    async scheduled(event, env, ctx) {
        console.log("💓 Heartbeat triggered at", new Date().toISOString());

        const url = env.TARGET_URL;
        const secret = env.CRON_SECRET; // Should be set in Cloudflare Secrets

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${secret}`
                }
            });

            const text = await response.text();
            console.log(`[Heartbeat] Response: ${response.status} - ${text}`);
        } catch (err) {
            console.error(`[Heartbeat] Failed: ${err.message}`);
        }
    },

    // Allow manual trigger via HTTP for testing
    async fetch(request, env, ctx) {
        await this.scheduled(null, env, ctx);
        return new Response("Heartbeat Sent", { status: 200 });
    }
};
