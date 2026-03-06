/**
 * Researcher Cron Job
 *
 * Runs daily to gather market intelligence:
 * - Analyzes ClawTasks bounty patterns
 * - Posts survey to Moltbook
 * - Generates weekly insights report (Sundays)
 *
 * Schedule: Daily at 9am UTC
 */

export default async function handler(req, res) {
    // Security Check (Vercel Cron)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (process.env.ENABLE_RESEARCHER_CRON !== '1') {
        return res.status(200).json({ status: 'Researcher cron disabled' });
    }

    try {
        const { ResearcherAgent } = await import('../../src/agents/ResearcherAgent.js');
        const researcher = new ResearcherAgent();
        await researcher.runCycle();

        res.status(200).json({
            status: 'Research cycle complete',
            question: researcher.getTodaysQuestion()
        });
    } catch (error) {
        console.error('[Researcher Cron] Error:', error);
        res.status(500).json({ error: error.message });
    }
}
