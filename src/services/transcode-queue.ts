/**
 * Submit transcoding jobs to the Lyve Transcoder worker
 * Jobs are pushed to Redis queue, worker pulls and processes
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const QUEUE_NAME = 'transcode_jobs';

interface TranscodeJob {
    id: string;
    input_bucket: string;
    input_key: string;
    output_bucket: string;
    output_prefix: string;
    ladder?: Array<{
        name: string;
        height: number;
        bitrate: string;
        audio_bitrate: string;
    }>;
    webhook_url?: string;
    metadata?: Record<string, any>;
}

/**
 * Submit a video for transcoding
 */
export async function submitTranscodeJob(
    inputKey: string,
    options: Partial<TranscodeJob> = {}
): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const bucket = process.env.LYVE_BUCKET || 'jettydata-prod';

    const job: TranscodeJob = {
        id: jobId,
        input_bucket: options.input_bucket || bucket,
        input_key: inputKey,
        output_bucket: options.output_bucket || bucket,
        output_prefix: options.output_prefix || `transcoded/${jobId}`,
        ladder: options.ladder,
        webhook_url: options.webhook_url,
        metadata: options.metadata
    };

    // Push to Redis queue (left side, worker pops from right)
    await redis.lpush(QUEUE_NAME, JSON.stringify(job));

    // Store job metadata
    await redis.hset(`job:${jobId}`, {
        status: 'queued',
        input_key: inputKey,
        created_at: new Date().toISOString()
    });

    return jobId;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<{
    status: string;
    outputs?: string[];
    error?: string;
}> {
    const data = await redis.hgetall(`job:${jobId}`);
    if (!data) {
        return { status: 'not_found' };
    }

    return {
        status: data.status as string || 'unknown',
        outputs: data.outputs ? JSON.parse(data.outputs as string) : undefined,
        error: data.error as string || undefined
    };
}

/**
 * Get queue length
 */
export async function getQueueLength(): Promise<number> {
    return await redis.llen(QUEUE_NAME);
}
