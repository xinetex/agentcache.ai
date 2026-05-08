/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { Hono } from 'hono';
import {
    buildMediaPlan,
    getJobStatus,
    getQueueLength,
    getRecentTranscodeJobs,
    getTranscodeProfiles,
    submitMediaJob,
} from '../services/transcode-queue.js';

const transcode = new Hono();

/**
 * GET /api/transcode/profiles
 * List supported AgentCache media output targets.
 */
transcode.get('/profiles', (c) => {
    return c.json({
        profiles: getTranscodeProfiles(),
    });
});

/**
 * POST /api/transcode/plan
 * Preview cache key, output layout, and validation rules before enqueueing.
 */
transcode.post('/plan', async (c) => {
    try {
        const body = await c.req.json();
        const { inputKey, profile, outputPrefix, inputBucket, outputBucket } = body;

        if (!inputKey) {
            return c.json({ error: 'inputKey is required' }, 400);
        }

        const plan = buildMediaPlan(inputKey, {
            profileId: profile || 'roku-hls',
            output_prefix: outputPrefix,
            input_bucket: inputBucket,
            output_bucket: outputBucket,
        });

        return c.json({ success: true, plan });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * POST /api/transcode/submit
 * Submit a video for transcoding
 */
transcode.post('/submit', async (c) => {
    try {
        const body = await c.req.json();
        const { inputKey, profile, outputPrefix, inputBucket, outputBucket, policyVersion } = body;

        if (!inputKey) {
            return c.json({ error: 'inputKey is required' }, 400);
        }

        const result = await submitMediaJob(inputKey, {
            profileId: profile || 'roku-hls',
            output_prefix: outputPrefix,
            input_bucket: inputBucket,
            output_bucket: outputBucket,
            policyVersion,
            webhook_url: process.env.WEBHOOK_URL
        });

        return c.json({
            success: true,
            jobId: result.jobId,
            status: result.status,
            cacheHit: result.cacheHit,
            profile: result.plan.profile.id,
            plan: result.plan,
            message: result.cacheHit
                ? `Transcoding skipped. Cached ${result.plan.profile.name} output is ready.`
                : `Transcoding job submitted. Profile: ${result.plan.profile.id}`
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
            phase: status.phase,
            progress: status.progress,
            inputKey: status.inputKey,
            outputPrefix: status.outputPrefix,
            profileId: status.profileId,
            cacheKey: status.cacheKey,
            cacheHit: status.cacheHit,
            outputs: status.outputs,
            validation: status.validation,
            probe: status.probe,
            provenance: status.provenance,
            plan: status.plan,
            error: status.error,
            createdAt: status.createdAt,
            updatedAt: status.updatedAt
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
        const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') || 20)));
        const jobs = await getRecentTranscodeJobs(limit);

        return c.json({ 
            queueLength,
            jobs,
            profiles: getTranscodeProfiles(),
            message: jobs.length ? 'Recent transcode jobs loaded' : 'No recent transcode jobs'
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
