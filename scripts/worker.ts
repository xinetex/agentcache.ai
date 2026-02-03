#!/usr/bin/env npx tsx
/**
 * Worker Script: Polls Lane Queues and Executes Agents
 * 
 * Usage:
 *   npx tsx scripts/worker.ts
 *   npx tsx scripts/worker.ts --lane software-quality
 * 
 * This runs locally or can be scheduled via Vercel Cron / Cloudflare Worker.
 */

import 'dotenv/config';
import { LaneService } from '../src/lib/workflow/LaneService.js';
import { TranscriptLogger } from '../src/lib/workflow/TranscriptLogger.js';
import { PRAgent } from '../src/agents/suite/PRAgent.js';

const lanes = new LaneService();

// Configuration
const LANES_TO_POLL = ['software-quality'];
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_JOBS_PER_CYCLE = 5;

async function processJob(lane: string, job: any) {
    console.log(`[Worker] Processing Job ${job.id} (${job.type}) from lane: ${lane}`);

    const logger = new TranscriptLogger(job.id, lane, job.type);

    try {
        await logger.init();
        logger.info('job_started', { type: job.type, payload: job.payload });

        switch (job.type) {
            case 'pr_review':
                const agent = new PRAgent();
                await agent.runReview({
                    owner: job.payload.owner,
                    repo: job.payload.repo,
                    prNumber: job.payload.prNumber,
                    title: job.payload.title,
                    author: job.payload.author
                });
                logger.info('pr_review_complete', { prNumber: job.payload.prNumber });
                break;

            default:
                logger.warn('unknown_job_type', { type: job.type });
                console.warn(`[Worker] Unknown job type: ${job.type}`);
        }

        await logger.flush('completed');
        console.log(`[Worker] Job ${job.id} completed successfully.`);

    } catch (err: any) {
        logger.error('job_failed', { error: err.message });
        await logger.flush('failed');
        console.error(`[Worker] Job ${job.id} failed:`, err.message);
    }
}

async function pollCycle() {
    for (const lane of LANES_TO_POLL) {
        let jobsProcessed = 0;

        while (jobsProcessed < MAX_JOBS_PER_CYCLE) {
            const job = await lanes.poll(lane);

            if (!job) {
                // Queue is empty for this lane
                break;
            }

            await processJob(lane, job);
            jobsProcessed++;
        }

        if (jobsProcessed > 0) {
            console.log(`[Worker] Processed ${jobsProcessed} jobs from lane: ${lane}`);
        }
    }
}

async function main() {
    console.log(`[Worker] Starting AgentCache Worker...`);
    console.log(`[Worker] Polling lanes: ${LANES_TO_POLL.join(', ')}`);
    console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
    console.log(`[Worker] Max jobs per cycle: ${MAX_JOBS_PER_CYCLE}`);
    console.log('---');

    // Check for one-shot mode (for Vercel Cron)
    if (process.argv.includes('--once')) {
        console.log('[Worker] Running single poll cycle...');
        await pollCycle();
        console.log('[Worker] Done.');
        return;
    }

    // Continuous polling loop
    while (true) {
        try {
            await pollCycle();
        } catch (err) {
            console.error('[Worker] Poll cycle error:', err);
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

main().catch(console.error);
