/**
 * Needs Refresh Cron Job
 *
 * Runs daily (30 min after ResearcherAgent) to pull fresh demand signals
 * from MaxxEval (system of record) into AgentCache needs_signals table.
 *
 * Schedule: Daily at 09:30 UTC
 */

export default async function handler(req: any, res: any) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3001';

        const response = await fetch(`${baseUrl}/api/needs/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CRON_SECRET}`
            }
        });

        const data = await response.json();

        res.status(200).json({
            status: 'Needs refresh complete',
            ...data
        });
    } catch (error: any) {
        console.error('[Needs Refresh Cron] Error:', error);
        res.status(500).json({ error: error.message });
    }
}
