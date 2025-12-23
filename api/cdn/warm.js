/**
 * CDN Warm Handler - Pre-populate Cache
 * 
 * Warm the cache for specific content to improve first-request latency.
 * Used by Audio1.TV to pre-cache popular or upcoming content.
 */

import { getVideoCache } from '../../transcoder-service/videocache.js';

export default async function handler(req) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const body = await req.json();
        const { jobId, quality = '720p', path } = body;

        if (!jobId && !path) {
            return new Response(JSON.stringify({
                error: 'Missing required parameter',
                usage: { jobId: 'video-job-id', quality: '720p' }
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

        // Determine playlist path
        const playlistPath = path || `hls/${jobId}/${quality}/playlist.m3u8`;

        console.log(`🔥 Warming cache for: ${playlistPath}`);

        // Warm the playlist and its segments
        await cache.warmPlaylist(playlistPath);

        return new Response(JSON.stringify({
            success: true,
            message: `Cache warmed for ${playlistPath}`,
            jobId,
            quality,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('CDN warm error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to warm cache',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
