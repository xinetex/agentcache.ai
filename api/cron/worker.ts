
import { LaneService } from '../src/lib/workflow/LaneService.js';
import { TranscriptLogger } from '../src/lib/workflow/TranscriptLogger.js';
import { PRAgent } from '../src/agents/suite/PRAgent.js';

export const config = {
    runtime: 'nodejs',
};

const lanes = new LaneService();

/**
 * Vercel Cron Handler: Drain the software-quality queue
 * Schedule this in vercel.json: { "path": "/api/cron/worker", "schedule": "* * * * *" }
 */
export default async function handler(req, res) {
    const MAX_JOBS = 5;
    let processed = 0;

    try {
        for (let i = 0; i < MAX_JOBS; i++) {
            const job = await lanes.poll('software-quality');

            if (!job) break;

            console.log(`[CronWorker] Processing job: ${job.id}`);

            const logger = new TranscriptLogger(job.id, 'software-quality', job.type);
            await logger.init();

            try {
                if (job.type === 'pr_review') {
                    const agent = new PRAgent();
                    await agent.runReview(job.payload);
                    logger.info('pr_review_complete', { prNumber: job.payload.prNumber });
                }
                await logger.flush('completed');
            } catch (err: any) {
                logger.error('job_failed', { error: err.message });
                await logger.flush('failed');
            }

            processed++;
        }

        return res.status(200).json({
            success: true,
            processed,
            message: processed > 0 ? `Drained ${processed} jobs` : 'Queue empty'
        });

    } catch (err: any) {
        console.error('[CronWorker] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
