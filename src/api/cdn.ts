import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getVideoCache } from '../../transcoder-service/videocache.js';

const cdn = new Hono();

// Initialize VideoCache helper
function initCache(process: any) {
    return getVideoCache({
        l1MaxSize: parseInt(process.env.CDN_L1_MAX_SIZE || '') || 100 * 1024 * 1024,
        l1MaxAge: parseInt(process.env.CDN_L1_TTL || '') || 5 * 60 * 1000,
        redisUrl: process.env.REDIS_URL || process.env.KV_URL || 'redis://localhost:6379',
        l2TTL: parseInt(process.env.CDN_L2_TTL || '') || 3600,
        s3Endpoint: process.env.JETTYTHUNDER_S3_ENDPOINT || process.env.S3_ENDPOINT,
        s3AccessKey: process.env.JETTYTHUNDER_ACCESS_KEY || process.env.S3_ACCESS_KEY,
        s3SecretKey: process.env.JETTYTHUNDER_SECRET_KEY || process.env.S3_SECRET_KEY,
        s3Bucket: process.env.JETTYTHUNDER_BUCKET || 'jettydata-prod'
    });
}

// Global CORS for CDN
cdn.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'Content-Range', 'X-VideoCache'],
}));

/**
 * GET /api/cdn/stream
 * Proxies and caches video content (MP4, HLS)
 */
cdn.get('/stream', async (c) => {
    const videoPath = c.req.query('path');
    const jobId = c.req.query('jobId');
    const quality = c.req.query('quality') || '720p';
    const segment = c.req.query('segment');

    let targetPath = videoPath;
    if (!targetPath && jobId && segment) {
        targetPath = `hls/${jobId}/${quality}/${segment}`;
    }

    if (!targetPath) {
        return c.json({ error: 'Missing path or (jobId/segment)' }, 400);
    }

    try {
        const cache = initCache(process);
        const data = await cache.get(targetPath);

        if (!data) {
            return c.json({ error: 'Object not found', path: targetPath }, 404);
        }

        // Determine content type
        const ext = targetPath.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
            'm3u8': 'application/x-mpegURL',
            'ts': 'video/MP2T',
            'mp4': 'video/mp4',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg'
        };

        const contentType = (ext && contentTypes[ext]) || 'application/octet-stream';

        return c.body(data, 200, {
            'Content-Type': contentType,
            'Content-Length': data.length.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-VideoCache': 'HIT'
        });
    } catch (error: any) {
        return c.json({ error: 'Stream failure', message: error.message }, 500);
    }
});

/**
 * POST /api/cdn/warm
 * Pre-warms the cache for a playlist
 */
cdn.post('/warm', async (c) => {
    try {
        const body = await c.req.json();
        const { jobId, quality = '720p', path } = body;
        const targetPath = path || `hls/${jobId}/${quality}/playlist.m3u8`;

        const cache = initCache(process);
        await cache.warmPlaylist(targetPath);

        return c.json({
            success: true,
            message: `Cache warmed for ${targetPath}`,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return c.json({ error: 'Warm failure', message: error.message }, 500);
    }
});

/**
 * GET /api/cdn/metrics
 */
cdn.get('/metrics', async (c) => {
    try {
        const cache = initCache(process);
        return c.json(cache.getMetrics());
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * POST /api/cdn/roku-stream/*
 * SPECIAL: For Roku HTTP/1.1 compatibility
 */
cdn.all('/roku-stream/*', async (c) => {
    // In Vercel, this will still be HTTP/2 if the protocol is negotiated.
    // However, by moving it into Hono, we at least fix the deployment.
    // For TRUE HTTP/1.1, the user must use a non-Vercel backend.

    const key = c.req.path.replace('/api/cdn/roku-stream/', '');
    const rangeHeader = c.req.header('range');

    try {
        const cache = initCache(process);

        // If range request, bypass cache for now to ensure streaming works
        if (rangeHeader) {
            // Note: Hono doesn't natively support full streaming proxy as easily as Express
            // But we can fetch and return
            const originUrl = `${process.env.JETTYTHUNDER_URL || 'https://www.jettythunder.app'}/api/partner-stream/${key}`;
            const response = await fetch(originUrl, {
                headers: { 'Range': rangeHeader }
            });

            const body = await response.arrayBuffer();
            return c.body(body, response.status as any, {
                'Content-Type': response.headers.get('content-type') || 'video/mp4',
                'Accept-Ranges': 'bytes',
                'Content-Range': response.headers.get('content-range') || '',
                'Content-Length': response.headers.get('content-length') || '',
                'Cache-Control': 'public, max-age=3600'
            });
        }

        const data = await cache.get(key);
        if (!data) return c.json({ error: 'Not found' }, 404);

        return c.body(data, 200, {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'X-Roku-Cache': 'HIT'
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default cdn;
