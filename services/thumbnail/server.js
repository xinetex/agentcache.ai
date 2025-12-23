/**
 * Thumbnail Service API
 * Generates thumbnails from HLS streams using ffmpeg
 * 
 * Endpoints:
 *   POST /generate - Generate thumbnails from video URL
 *   GET /health - Health check
 *   GET /thumbnails/:id - Get thumbnail manifest
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const THUMBNAIL_DIR = process.env.THUMBNAIL_DIR || '/app/thumbnails';

// S3 client for uploading thumbnails
const s3 = new S3Client({
    region: process.env.LYVE_CLOUD_REGION || 'us-west-1',
    endpoint: process.env.LYVE_CLOUD_ENDPOINT,
    credentials: {
        accessKeyId: process.env.LYVE_CLOUD_ACCESS_KEY || '',
        secretAccessKey: process.env.LYVE_CLOUD_SECRET_KEY || '',
    },
    forcePathStyle: true,
});

const BUCKET = process.env.LYVE_CLOUD_BUCKET || 'jettydata-prod';

// In-memory job tracking
const jobs = new Map();

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'thumbnail', timestamp: new Date().toISOString() });
});

/**
 * POST /generate
 * Generate thumbnails from a video URL
 * 
 * Body: { url, count?, width?, height?, uploadToS3? }
 * Returns: { jobId, status }
 */
app.post('/generate', async (req, res) => {
    const { url, count = 10, width = 320, height = 180, uploadToS3 = true, videoId } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'url is required' });
    }

    const jobId = videoId || uuidv4();
    const outputDir = path.join(THUMBNAIL_DIR, jobId);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Track job
    jobs.set(jobId, {
        status: 'processing',
        url,
        outputDir,
        thumbnails: [],
        startedAt: new Date().toISOString()
    });

    // Start async processing
    processThumbnails(jobId, url, count, width, height, outputDir, uploadToS3);

    res.json({ jobId, status: 'processing' });
});

/**
 * Generate thumbnails using ffmpeg
 */
async function processThumbnails(jobId, url, count, width, height, outputDir, uploadToS3) {
    const job = jobs.get(jobId);

    try {
        // Get video duration first
        const duration = await getVideoDuration(url);
        const interval = duration / (count + 1);

        console.log(`[Thumbnail] Job ${jobId}: Duration ${duration}s, generating ${count} thumbnails`);

        const thumbnails = [];

        // Generate thumbnails at intervals
        for (let i = 1; i <= count; i++) {
            const timestamp = Math.floor(interval * i);
            const filename = `thumb_${String(i).padStart(3, '0')}.jpg`;
            const outputPath = path.join(outputDir, filename);

            await extractFrame(url, timestamp, outputPath, width, height);

            let thumbnailUrl = outputPath;

            // Upload to S3 if requested
            if (uploadToS3) {
                thumbnailUrl = await uploadToStorage(outputPath, `thumbnails/${jobId}/${filename}`);
            }

            thumbnails.push({
                index: i,
                timestamp,
                url: thumbnailUrl,
                width,
                height
            });

            console.log(`[Thumbnail] Job ${jobId}: Generated ${i}/${count}`);
        }

        // Update job status
        job.status = 'completed';
        job.thumbnails = thumbnails;
        job.completedAt = new Date().toISOString();
        job.posterUrl = thumbnails[Math.floor(count / 2)]?.url; // Middle frame as poster

        console.log(`[Thumbnail] Job ${jobId}: Completed with ${thumbnails.length} thumbnails`);

    } catch (error) {
        console.error(`[Thumbnail] Job ${jobId}: Error -`, error);
        job.status = 'failed';
        job.error = error.message;
    }
}

/**
 * Get video duration using ffprobe
 */
function getVideoDuration(url) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            url
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => { output += data.toString(); });
        ffprobe.stderr.on('data', (data) => { console.error(`ffprobe: ${data}`); });

        ffprobe.on('close', (code) => {
            if (code === 0) {
                resolve(parseFloat(output.trim()) || 60);
            } else {
                // Default to 60 seconds if duration detection fails
                resolve(60);
            }
        });

        ffprobe.on('error', () => resolve(60));
    });
}

/**
 * Extract a single frame using ffmpeg
 */
function extractFrame(url, timestamp, outputPath, width, height) {
    return new Promise((resolve, reject) => {
        const args = [
            '-ss', String(timestamp),
            '-i', url,
            '-vframes', '1',
            '-vf', `scale=${width}:${height}`,
            '-q:v', '2',
            '-y',
            outputPath
        ];

        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.stderr.on('data', (data) => {
            // ffmpeg outputs to stderr normally
        });

        ffmpeg.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputPath)) {
                resolve(outputPath);
            } else {
                reject(new Error(`ffmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', reject);
    });
}

/**
 * Upload file to S3/Lyve Cloud
 */
async function uploadToStorage(localPath, key) {
    const fileBuffer = fs.readFileSync(localPath);

    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
    }));

    const endpoint = process.env.LYVE_CLOUD_ENDPOINT || '';
    return `https://${BUCKET}.${endpoint.replace('https://', '')}/${key}`;
}

/**
 * GET /jobs/:id
 * Get job status and thumbnails
 */
app.get('/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
});

/**
 * GET /poster/:id
 * Get the poster (middle thumbnail) for a video
 */
app.get('/poster/:id', (req, res) => {
    const job = jobs.get(req.params.id);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
        return res.json({ status: job.status, posterUrl: null });
    }

    res.json({
        status: 'completed',
        posterUrl: job.posterUrl,
        thumbnails: job.thumbnails
    });
});

// Serve static thumbnails (for local dev)
app.use('/thumbnails', express.static(THUMBNAIL_DIR));

// Start server
app.listen(PORT, () => {
    console.log(`[Thumbnail Service] Running on port ${PORT}`);
    console.log(`[Thumbnail Service] Output directory: ${THUMBNAIL_DIR}`);
    console.log(`[Thumbnail Service] S3 Bucket: ${BUCKET}`);
});
