/**
 * CDN Stream Handler - Audio1.TV Video Streaming
 * 
 * Serves HLS video segments with tiered caching for Roku, Web, and Mobile players.
 * Public endpoint (no auth required) for player access.
 * 
 * Supports:
 * - HLS playlists (.m3u8)
 * - Video segments (.ts)
 * - CORS for cross-origin requests from players
 */

import { getVideoCache } from '../../transcoder-service/videocache.js';

// Initialize VideoCache singleton
let videoCache = null;

function initVideoCache() {
    if (!videoCache) {
        videoCache = getVideoCache({
            // L1: In-memory (100MB, 5 minute TTL)
            l1MaxSize: parseInt(process.env.CDN_L1_MAX_SIZE) || 100 * 1024 * 1024,
            l1MaxAge: parseInt(process.env.CDN_L1_TTL) || 5 * 60 * 1000,

            // L2: Redis (from environment)
            redisUrl: process.env.REDIS_URL || process.env.KV_URL,
            l2TTL: parseInt(process.env.CDN_L2_TTL) || 3600,

            // L3: JettyThunder origin storage
            s3Endpoint: process.env.JETTYTHUNDER_S3_ENDPOINT || process.env.S3_ENDPOINT,
            s3AccessKey: process.env.JETTYTHUNDER_ACCESS_KEY || process.env.S3_ACCESS_KEY,
            s3SecretKey: process.env.JETTYTHUNDER_SECRET_KEY || process.env.S3_SECRET_KEY,
            s3Bucket: process.env.JETTYTHUNDER_BUCKET || 'audio1-videos'
        });
    }
    return videoCache;
}

/**
 * CORS headers for player access
 */
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, X-VideoCache'
    };
}

/**
 * Handle OPTIONS preflight requests
 */
function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders()
    });
}

/**
 * GET /api/cdn/stream?path=hls/jobId/720p/segment.ts
 * or
 * GET /api/cdn/stream/jobId/quality/segment.ts (via rewrite)
 */
export default async function handler(req) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleOptions();
    }

    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() }
        });
    }

    try {
        const cache = initVideoCache();

        // Parse URL to get path
        const url = new URL(req.url || '', 'http://localhost');
        let videoPath = url.searchParams.get('path');

        // Logic for path resolution:
        // 1. If 'path' param exists, use it (e.g. ?path=audio1/theme/logo.png)
        // 2. Otherwise try HLS jobId/quality/segment params
        if (!videoPath) {
            const jobId = url.searchParams.get('jobId');
            const quality = url.searchParams.get('quality');
            const segment = url.searchParams.get('segment');

            if (jobId && quality && segment) {
                videoPath = `hls/${jobId}/${quality}/${segment}`;
            }
        }

        // 3. Fallback: Parse path segments from the URL directly if mapped
        if (!videoPath) {
            // e.g. /api/cdn/stream/audio1/theme/logo.png
            const segments = url.pathname.split('/').filter(Boolean);
            const apiIndex = segments.indexOf('stream');
            if (apiIndex !== -1 && apiIndex < segments.length - 1) {
                videoPath = segments.slice(apiIndex + 1).join('/');
            }
        }

        if (!videoPath) {
            return new Response(JSON.stringify({
                error: 'Missing path parameter',
                usage: '/api/cdn/stream?path=audio1/theme/logo.png'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() }
            });
        }

        // Fetch from cache (L1 → L2 → L3)
        const data = await cache.get(videoPath);

        if (!data) {
            return new Response(JSON.stringify({
                error: 'Object not found',
                path: videoPath
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'X-VideoCache': 'MISS',
                    ...corsHeaders()
                }
            });
        }

        // Determine content type
        let contentType = 'application/octet-stream';
        const ext = videoPath.split('.').pop()?.toLowerCase();

        const contentTypes = {
            'm3u8': 'application/x-mpegURL',
            'ts': 'video/MP2T',
            'mp4': 'video/mp4',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'svg': 'image/svg+xml',
            'json': 'application/json'
        };

        if (ext && contentTypes[ext]) {
            contentType = contentTypes[ext];
        }

        // Return data with caching headers
        return new Response(data, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': data.length.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-VideoCache': 'HIT',
                ...corsHeaders()
            }
        });

    } catch (error) {
        console.error('CDN stream error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() }
        });
    }
}
