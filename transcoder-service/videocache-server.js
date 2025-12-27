/**
 * Audio1.TV - VideoCache Integration Example
 * 
 * This file shows how to integrate VideoCache with AgentCache.ai
 * and use it to serve HLS video content with tiered caching.
 */

const express = require('express');
const fetch = require('node-fetch');
const { VideoCache, videoCacheMiddleware, getVideoCache } = require('./videocache');


// Initialize VideoCache
const videoCache = getVideoCache({
    // L1: In-memory (100MB, 5 minute TTL)
    l1MaxSize: 100 * 1024 * 1024,
    l1MaxAge: 5 * 60 * 1000,

    // L2: Redis (from environment or Upstash)
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    l2TTL: 3600, // 1 hour

    // L3: JettyThunder/Lyve Cloud origin
    s3Endpoint: process.env.S3_ENDPOINT,
    s3AccessKey: process.env.S3_ACCESS_KEY,
    s3SecretKey: process.env.S3_SECRET_KEY,
    s3Bucket: process.env.S3_BUCKET || 'audio1-videos'
});

const app = express();

// Use VideoCache middleware for /hls/* routes
app.use(videoCacheMiddleware(videoCache, { basePath: '/hls' }));

// API: Cache metrics
app.get('/cache/metrics', (req, res) => {
    res.json(videoCache.getMetrics());
});

// API: Warm cache for a job
app.post('/cache/warm/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const quality = req.query.quality || '720p';

    try {
        await videoCache.warmPlaylist(`hls/${jobId}/${quality}/playlist.m3u8`);
        res.json({ success: true, message: `Cache warmed for job ${jobId}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Invalidate cache for a job
app.delete('/cache/:jobId', async (req, res) => {
    const { jobId } = req.params;

    try {
        await videoCache.invalidateJob(jobId);
        res.json({ success: true, message: `Cache invalidated for job ${jobId}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example: Direct segment fetch
app.get('/stream/:jobId/:quality/:segment', async (req, res) => {
    const { jobId, quality, segment } = req.params;
    const videoPath = `hls/${jobId}/${quality}/${segment}`;

    try {
        const data = await videoCache.get(videoPath);

        if (data) {
            if (segment.endsWith('.m3u8')) {
                res.set('Content-Type', 'application/x-mpegURL');
            } else {
                res.set('Content-Type', 'video/MP2T');
            }
            res.set('Cache-Control', 'public, max-age=31536000');
            return res.send(data);
        }

        res.status(404).json({ error: 'Segment not found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================================
// Audio1.tv Video Proxy - Caches JettyThunder partner streams
// =============================================================

const JETTYTHUNDER_BASE = process.env.JETTYTHUNDER_URL || 'https://jettythunder.app';

// L1 cache for Audio1 videos (simple in-memory with expiry)
const audio1Cache = new Map();
const AUDIO1_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getFromAudio1Cache(key) {
    const entry = audio1Cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        audio1Cache.delete(key);
        return null;
    }
    return entry.data;
}

function setToAudio1Cache(key, data, contentType) {
    audio1Cache.set(key, {
        data,
        contentType,
        expires: Date.now() + AUDIO1_CACHE_TTL
    });
}

/**
 * Audio1.tv Video Proxy
 * Proxies: /audio1/partner/userId/fileId/filename
 * To: https://jettythunder.app/api/partner-stream/audio1/userId/fileId/filename
 */
app.get('/audio1/:partner/:userId/:fileId/:filename', async (req, res) => {
    const { partner, userId, fileId, filename } = req.params;
    const cacheKey = `audio1:${partner}:${userId}:${fileId}:${filename}`;

    console.log(`[Audio1 Proxy] Request: ${cacheKey}`);

    // Check L1 cache
    const cached = getFromAudio1Cache(cacheKey);
    if (cached) {
        console.log(`[Audio1 Proxy] L1 HIT`);
        res.set('Content-Type', cached.contentType || 'video/mp4');
        res.set('Cache-Control', 'public, max-age=300');
        res.set('X-AudioCache', 'HIT');
        return res.send(cached.data);
    }

    // Fetch from JettyThunder
    const originUrl = `${JETTYTHUNDER_BASE}/api/partner-stream/${partner}/${userId}/${fileId}/${filename}`;
    console.log(`[Audio1 Proxy] L1 MISS - Fetching from: ${originUrl}`);

    try {
        const originResponse = await fetch(originUrl);


        if (!originResponse.ok) {
            console.error(`[Audio1 Proxy] Origin error: ${originResponse.status}`);
            return res.status(originResponse.status).json({ error: 'Origin fetch failed' });
        }

        const contentType = originResponse.headers.get('content-type') || 'video/mp4';
        const buffer = Buffer.from(await originResponse.arrayBuffer());

        // Cache the response
        setToAudio1Cache(cacheKey, buffer, contentType);
        console.log(`[Audio1 Proxy] Cached ${buffer.length} bytes`);

        // Respond with video
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=300');
        res.set('X-AudioCache', 'MISS');
        res.send(buffer);
    } catch (error) {
        console.error(`[Audio1 Proxy] Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Roku-Compatible HTTP/1.1 Streaming Endpoint
 * 
 * This endpoint serves content via HTTP/1.1 for Roku compatibility.
 * Roku has issues with HTTP/2 responses (Error -5 "malformed data").
 * 
 * Route: /roku-stream/:key
 * Example: /roku-stream/audio1/videos/2816/filename.mp4
 * 
 * Features:
 * - Range request support for seeking
 * - Proper content-type headers
 * - L1 caching for repeated requests
 */
app.get('/roku-stream/*', async (req, res) => {
    const key = req.params[0]; // Everything after /roku-stream/
    const cacheKey = `roku:${key}`;
    const rangeHeader = req.headers.range;

    console.log(`[Roku Proxy] Request: ${key} (Range: ${rangeHeader || 'none'})`);

    // For range requests, bypass cache and stream directly
    if (rangeHeader) {
        const originUrl = `${JETTYTHUNDER_BASE}/api/partner-stream/${key}`;
        console.log(`[Roku Proxy] Range request - streaming from origin`);

        try {
            const originResponse = await fetch(originUrl, {
                headers: { 'Range': rangeHeader }
            });

            if (!originResponse.ok && originResponse.status !== 206) {
                console.error(`[Roku Proxy] Origin error: ${originResponse.status}`);
                return res.status(originResponse.status).json({ error: 'Origin fetch failed' });
            }

            // Forward headers
            res.status(originResponse.status);
            res.set('Content-Type', originResponse.headers.get('content-type') || 'video/mp4');
            res.set('Accept-Ranges', 'bytes');
            res.set('Cache-Control', 'public, max-age=3600');

            const contentRange = originResponse.headers.get('content-range');
            if (contentRange) res.set('Content-Range', contentRange);

            const contentLength = originResponse.headers.get('content-length');
            if (contentLength) res.set('Content-Length', contentLength);

            // Stream the response
            const buffer = Buffer.from(await originResponse.arrayBuffer());
            res.send(buffer);
        } catch (error) {
            console.error(`[Roku Proxy] Range error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
        return;
    }

    // Check L1 cache for full requests
    const cached = getFromAudio1Cache(cacheKey);
    if (cached) {
        console.log(`[Roku Proxy] L1 HIT`);
        res.set('Content-Type', cached.contentType || 'video/mp4');
        res.set('Accept-Ranges', 'bytes');
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('X-Roku-Cache', 'HIT');
        return res.send(cached.data);
    }

    // Fetch from JettyThunder
    const originUrl = `${JETTYTHUNDER_BASE}/api/partner-stream/${key}`;
    console.log(`[Roku Proxy] L1 MISS - Fetching from: ${originUrl}`);

    try {
        const originResponse = await fetch(originUrl);

        if (!originResponse.ok) {
            console.error(`[Roku Proxy] Origin error: ${originResponse.status}`);
            return res.status(originResponse.status).json({ error: 'Origin fetch failed' });
        }

        const contentType = originResponse.headers.get('content-type') || 'video/mp4';
        const buffer = Buffer.from(await originResponse.arrayBuffer());

        // Only cache small files (< 10MB) to avoid memory issues
        if (buffer.length < 10 * 1024 * 1024) {
            setToAudio1Cache(cacheKey, buffer, contentType);
            console.log(`[Roku Proxy] Cached ${buffer.length} bytes`);
        } else {
            console.log(`[Roku Proxy] Skipping cache for large file (${buffer.length} bytes)`);
        }

        // Respond with content
        res.set('Content-Type', contentType);
        res.set('Accept-Ranges', 'bytes');
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('X-Roku-Cache', 'MISS');
        res.send(buffer);
    } catch (error) {
        console.error(`[Roku Proxy] Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// API: Audio1 cache stats
app.get('/audio1/stats', (req, res) => {
    res.json({
        entries: audio1Cache.size,
        ttlSeconds: AUDIO1_CACHE_TTL / 1000
    });
});


module.exports = { app, videoCache };

// If running directly
if (require.main === module) {
    const PORT = process.env.CACHE_PORT || 3003;
    app.listen(PORT, () => {
        console.log(`
🎬 VideoCache Server
====================
Port: ${PORT}
Metrics: GET /cache/metrics
Warm: POST /cache/warm/:jobId
Stream: GET /stream/:jobId/:quality/:segment

Ready to cache! 🚀
        `);
    });
}
