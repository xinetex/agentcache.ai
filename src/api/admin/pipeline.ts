import { Hono } from 'hono';
import { pipelineService } from '../../services/PipelineService.js';

const pipelineAdminRouter = new Hono();

/**
 * GET /api/admin/pipeline/jobs
 * List recent agent jobs and their transcripts.
 */
pipelineAdminRouter.get('/jobs', async (c) => {
    try {
        const jobs = await pipelineService.getRecentJobs(20);
        return c.json({ count: jobs.length, jobs });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * GET /api/admin/pipeline/jobs/:id
 * Get full transcript for a specific job.
 */
pipelineAdminRouter.get('/jobs/:id', async (c) => {
    try {
        const id = c.req.param('id');
        // Logic to fetch detailed job transcript is already in getRecentJobs 
        // if we just filter, or we can add a specific method.
        const jobs = await pipelineService.getRecentJobs(100);
        const job = jobs.find(j => j.jobId === id);
        if (!job) return c.json({ error: 'Job not found' }, 404);
        return c.json({ success: true, job });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export { pipelineAdminRouter };
