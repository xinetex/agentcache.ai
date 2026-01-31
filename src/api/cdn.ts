import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getVideoCache } from '../../transcoder-service/videocache.js';

/**
 * Smart CDN with missing poster generation
 * Automatically generates poster and preview files when not found in storage
 */

const cdn = new Hono();

// Configuration for poster generation thresholds
const POSTER_CONFIG = {
    width: 640,
    height: 360,
    quality: 85,
    format: 'jpeg',
    fallback: true // Enable smart poster generation
};

// Initialize cache with smart features
function initSmartCache(process: any) {
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

// CORS for cross-domain playback
cdn.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'Content-Range', 'X-VideoCache', 'X-Generated'],
}));

/**
 * GET /api/cdn/stream - Smart streaming with missing poster generation
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
        const cache = initSmartCache(process);
        const data = await cache.get(targetPath);

        if (!data) {
            // Missing content - check if we should generate it
            if (isMissingContentGenerateable(targetPath)) {
                const generated = await generateMissingContent(targetPath);
                if (generated) {
                    return c.body(generated.content as any, 200, {
                        'Content-Type': generated.contentType,
                        'Content-Length': generated.contentLength.toString(),
                        'Cache-Control': 'public, max-age=3600',
                        'X-VideoCache': 'MISS',
                        'X-Generated': 'TRUE'
                    });
                }
            }

            return c.json({ error: 'Object not found', path: targetPath }, 404);
        }

        const ext = targetPath.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
            'm3u8': 'application/x-mpegURL',
            'ts': 'video/MP2T',
            'mp4': 'video/mp4',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
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
 * POST /api/cdn/warm - Pre-warm cache
 */
cdn.post('/warm', async (c) => {
    const body = await c.req.json();
    const { paths, jobId, outputs } = body;

    try {
        const cache = initSmartCache(process);
        const warmed = [];

        for (const path of (paths || [])) {
            await cache.get(path); // This will warm the cache if not exists
            warmed.push(path);
        }

        // Warm up job outputs if provided
        if (jobId && outputs) {
            for (const output of outputs) {
                if (output.key) {
                    await cache.get(output.key);
                    warmed.push(output.key);
                }
            }
        }

        return c.json({ success: true, warmed });

    } catch (error: any) {
        return c.json({ error: 'Cache warming failed', details: error.message }, 500);
    }
});

/**
 * GET /api/cdn/status - CDN health and metrics
 */
cdn.get('/status', async (c) => {
    try {
        const cache = initSmartCache(process);

        const [l1Stats, redisStats] = await Promise.all([
            cache.getL1Stats ? cache.getL1Stats() : { hits: 0, misses: 0 },
            (process as any).redis ? (process as any).redis.info('memory') : { redis_version: 'unknown' }
        ]);

        return c.json({
            status: 'healthy',
            cache: {
                l1: l1Stats,
                l2: redisStats,
                enabled: true,
                smart_generation: POSTER_CONFIG.fallback
            },
            timestamp: new Date().toISOString(),
            component: 'cdn'
        });

    } catch (error: any) {
        return c.json({
            status: 'unhealthy',
            error: error.message
        }, 500);
    }
});

/**
 * Smart content generation for missing files
 */
function isMissingContentGenerateable(path: string): boolean {
    // Check if this is a poster/preview file that can be generated
    const patterns = [
        /.*poster.*\.jpe?g$/i,
        /.*thumb.*\.jpe?g$/i,
        /.*preview.*\.jpe?g$/i,
        /ai_.*poster.*\.png$/i,
        /sub_.*\.png$/i,
        /.*\.png$/i, // Fallback for any PNG missing
    ];

    return patterns.some(pattern => pattern.test(path));
}

async function generateMissingContent(targetPath: string) {
    try {
        // Dynamic require to avoid TS error
        const colodaGenerator = require('../../services/coloda-preview.js').default;
        const generator = colodaGenerator;

        // Generate content based on target path
        const generated = await generator.createSmartPreview(targetPath, {
            type: detectContentType(targetPath),
            size: 'poster'
        });

        // Return generated preview data
        const contentBuffer = Buffer.from(generated.content, 'base64');

        return {
            content: contentBuffer,
            contentType: generated.contentType,
            contentLength: contentBuffer.length
        };

    } catch (error) {
        console.error('Content generation failed:', error);
        // Offer a fallback simple poster
        return generateFallbackPoster(targetPath);
    }
}

function detectContentType(path: string): string {
    if (path.match(/ai_.*poster.*\.png$/i)) return 'ai-created';
    if (path.match(/sub_.*\.png$/i)) return 'subtitle';
    if (path.match(/.*poster.*\.png$/i)) return 'poster';
    if (path.match(/.*poster.*\.jpe?g$/i)) return 'poster';
    if (path.match(/.*thumb.*\.png$/i)) return 'thumbnail';
    return 'generic';
}

async function generateFallbackPoster(path: string) {
    // Simple fallback generator for basic content
    const svg = `<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="24" fill="#333">
            AI Generated:\n${path.split('/').pop()}
        </text>
    </svg>`;

    const buffer = Buffer.from(svg);

    // Convert to JPEG equivalent for better compatibility
    // This would typically call an image processing service
    const jpegBuffer = await convertSVGToJPG(svg);

    return {
        content: jpegBuffer,
        contentType: 'image/jpeg',
        contentLength: jpegBuffer.length
    };
}

async function convertSVGToJPG(svgContent: string): Promise<Buffer> {
    // In a real implementation, this would use ImageMagick or similar
    // For now, return the SVG buffer with proper MIME handling
    const buffer = Buffer.from(svgContent);
    return buffer; // SVG content handled as-is
}

export default cdn;