
import { growthAgent } from '../../src/agents/GrowthAgent.js';

export default async function handler(req, res) {
    // 1. Security Check
    const authHeader = req.headers.authorization;
    const CRON_SECRET = process.env.CRON_SECRET || 'mock-secret';

    // Allow if secret matches OR if running locally in dev (implicit trust for demo)
    if (authHeader !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized Pulse' });
    }

    try {
        console.log("[Cron] Activating Growth Flywheel...");

        // 2. Run the Autonomous Cycle
        // (Scan Moltbook -> Buy Service -> Post Result)
        await growthAgent.runCycle();

        return res.status(200).json({
            success: true,
            message: "Flywheel Cycle Completed",
            agentId: growthAgent.id
        });
    } catch (err) {
        console.error("[Cron] Flywheel Failed:", err);
        return res.status(500).json({ error: err.message });
    }
}
