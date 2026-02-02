
import { ClawService } from '../../src/services/ClawService.js';

export default async function handler(req, res) {
    // 1. Security Check (Vercel Cron)
    // Vercel automatically injects CRON_SECRET header
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Also allow local testing with a special flag if needed, but fail safe by default
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiToken = process.env.CLAW_API_TOKEN;
    if (!apiToken) {
        console.error('CLAW_API_TOKEN missing');
        return res.status(500).json({ error: 'Configuration Error' });
    }

    try {
        const service = new ClawService(apiToken);
        await service.runOnce();
        res.status(200).json({ status: 'Job Completed' });
    } catch (error) {
        console.error('Claw Cron Error:', error);
        res.status(500).json({ error: error.message });
    }
}
