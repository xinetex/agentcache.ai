import { Hono } from 'hono';
import { submitTranscodeJob, getJobStatus, getQueueLength } from '../services/transcode-queue.js';

const transcode = new Hono();

/**
 * POST /api/transcode/submit
 * Submit a video for transcoding
 */
transcode.post('/submit', async (c) => {
    try {
        const body = await c.req.json();
        const { inputKey, profile, outputPrefix } = body;

        if (!inputKey) {
            return c.json({ error: 'inputKey is required' }, 400);
        }

        const jobId = await submitTranscodeJob(inputKey, {
            output_prefix: outputPrefix,
            webhook_url: process.env.WEBHOOK_URL
        });

        return c.json({
            success: true,
            jobId,
            status: 'queued',
            message: `Transcoding job submitted. Profile: ${profile || 'roku-hls'}`
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * GET /api/transcode/status/:jobId
 * Get transcoding job status
 */
transcode.get('/status/:jobId', async (c) => {
    try {
        const jobId = c.req.param('jobId');
        const status = await getJobStatus(jobId);

        return c.json({
            jobId,
            status: status.status,
            outputs: status.outputs,
            error: status.error
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * GET /api/transcode/jobs
 * List all transcoding jobs
 */
transcode.get('/jobs', async (c) => {
    try {
        const queueLength = await getQueueLength();

        return c.json({ 
            queueLength,
            message: 'Full job listing not yet implemented'
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * POST /api/transcode/cancel/:jobId
 * Cancel a pending job
 */
transcode.post('/cancel/:jobId', async (c) => {
    try {
        const jobId = c.req.param('jobId');
        
        return c.json({ 
            success: false, 
            message: 'Job cancellation not yet implemented' 
        }, 501);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default transcode;
