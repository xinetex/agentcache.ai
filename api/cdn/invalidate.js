/**
 * CDN Invalidate Handler - Clear Cached Content
 * 
 * Invalidate specific content or entire jobs from the cache.
 * Used when content is updated or removed.
 */

import { getVideoCache } from '../../transcoder-service/videocache.js';

export default async function handler(req) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST' && req.method !== 'DELETE') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const body = await req.json();
        const { path, jobId } = body;

        if (!path && !jobId) {
            return new Response(JSON.stringify({
                error: 'Missing required parameter',
                usage: { path: 'hls/jobId/720p/segment.ts' }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const cache = getVideoCache({
            redisUrl: process.env.REDIS_URL || process.env.KV_URL,
            s3Endpoint: process.env.JETTYTHUNDER_S3_ENDPOINT || process.env.S3_ENDPOINT,
            s3AccessKey: process.env.JETTYTHUNDER_ACCESS_KEY || process.env.S3_ACCESS_KEY,
            s3SecretKey: process.env.JETTYTHUNDER_SECRET_KEY || process.env.S3_SECRET_KEY,
            s3Bucket: process.env.JETTYTHUNDER_BUCKET || 'audio1-videos'
        });

        if (jobId) {
            // Invalidate all segments for a job
            console.log(`🗑️ Invalidating cache for job: ${jobId}`);
            await cache.invalidateJob(jobId);

            return new Response(JSON.stringify({
                success: true,
                message: `Cache invalidated for job ${jobId}`,
                jobId,
                timestamp: new Date().toISOString()
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Invalidate specific path
        console.log(`🗑️ Invalidating cache for: ${path}`);
        await cache.invalidate(path);

        return new Response(JSON.stringify({
            success: true,
            message: `Cache invalidated for ${path}`,
            path,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('CDN invalidate error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to invalidate cache',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
