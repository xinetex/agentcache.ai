
import { ClawTasksService } from '../../src/services/ClawTasksService.js';

export default async function handler(req, res) {
    // 1. Security Check (Vercel Cron)
    // Vercel automatically injects CRON_SECRET header
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Also allow local testing with a special flag if needed, but fail safe by default
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiToken = process.env.CLAWTASKS_API_KEY;
    if (!apiToken) {
        console.warn('[ClawWorker] CLAWTASKS_API_KEY missing - skipping');
        return res.status(200).json({ status: 'Skipped - no API key' });
    }

    try {
        const service = new ClawTasksService(apiToken);
        await service.runOnce();
        res.status(200).json({ status: 'Job Completed' });
    } catch (error) {
        console.error('ClawTasks Cron Error:', error);
        res.status(500).json({ error: error.message });
    }
}
