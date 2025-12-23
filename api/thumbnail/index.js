/**
 * Thumbnail API - AgentCache
 * Proxies requests to the thumbnail microservice
 * 
 * POST /api/thumbnail/generate - Generate thumbnails from video URL
 * GET /api/thumbnail/status/:id - Get thumbnail job status
 */

const express = require('express');
const router = express.Router();

const THUMBNAIL_SERVICE = process.env.THUMBNAIL_SERVICE_URL || 'http://thumbnail:8080';

/**
 * POST /api/thumbnail/generate
 * Generate thumbnails for a video
 */
router.post('/generate', async (req, res) => {
    try {
        const { url, videoId, count, width, height } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'url is required' });
        }

        console.log(`[Thumbnail API] Generating thumbnails for: ${url}`);

        const response = await fetch(`${THUMBNAIL_SERVICE}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                videoId,
                count: count || 10,
                width: width || 320,
                height: height || 180,
                uploadToS3: true
            })
        });

        const data = await response.json();

        res.json(data);

    } catch (error) {
        console.error('[Thumbnail API] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/thumbnail/status/:id
 * Get thumbnail generation status
 */
router.get('/status/:id', async (req, res) => {
    try {
        const response = await fetch(`${THUMBNAIL_SERVICE}/jobs/${req.params.id}`);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Job not found' });
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('[Thumbnail API] Status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/thumbnail/poster/:id
 * Get the poster URL for a completed job
 */
router.get('/poster/:id', async (req, res) => {
    try {
        const response = await fetch(`${THUMBNAIL_SERVICE}/poster/${req.params.id}`);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Job not found' });
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('[Thumbnail API] Poster error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/thumbnail/health
 * Check thumbnail service health
 */
router.get('/health', async (req, res) => {
    try {
        const response = await fetch(`${THUMBNAIL_SERVICE}/health`);
        const data = await response.json();
        res.json({ agentcache: 'ok', thumbnail_service: data });
    } catch (error) {
        res.json({ agentcache: 'ok', thumbnail_service: 'unavailable' });
    }
});

module.exports = router;
