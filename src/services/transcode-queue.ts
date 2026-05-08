/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */
/**
 * Submit transcoding jobs to the Lyve Transcoder worker.
 * Jobs are pushed to Redis queue, worker pulls and processes them with FFmpeg.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';

const QUEUE_NAME = 'transcode_jobs';
const RECENT_JOBS_KEY = 'transcode:recent_jobs';
const CACHE_PREFIX = 'transcodecache:v1';
const DEFAULT_BUCKET = process.env.LYVE_BUCKET || 'jettydata-prod';
const DEFAULT_POLICY_VERSION = process.env.MEDIA_POLICY_VERSION || 'media-policy-v1';
const DEFAULT_FFMPEG_BUILD = process.env.FFMPEG_BUILD_TAG || process.env.FFMPEG_VERSION || 'system-ffmpeg';

export interface TranscodeLadderRung {
    name: string;
    height: number;
    bitrate: string;
    audio_bitrate: string;
}

export interface TranscodeProfile {
    id: string;
    name: string;
    target: string;
    container: string;
    description: string;
    segmentSeconds: number;
    ladder: TranscodeLadderRung[];
    validationRules: string[];
    publishHints: string[];
}

export interface TranscodeJob {
    id: string;
    input_bucket: string;
    input_key: string;
    output_bucket: string;
    output_prefix: string;
    ladder?: TranscodeLadderRung[];
    webhook_url?: string;
    watermark?: string;
    metadata?: Record<string, any>;
}

export interface MediaPlan {
    profile: TranscodeProfile;
    input: {
        bucket: string;
        key: string;
        sourceFingerprint: string;
    };
    output: {
        bucket: string;
        prefix: string;
        masterManifestKey: string;
        expectedRenditions: number;
    };
    cache: {
        key: string;
        policyVersion: string;
        ffmpegBuild: string;
        lookupKey: string;
    };
    phases: Array<{
        id: string;
        label: string;
        progress: number;
    }>;
    validation: {
        rules: string[];
        target: string;
    };
    provenance: {
        engine: string;
        plannedAt: string;
        commandShape: string[];
    };
}

export interface MediaSubmitResult {
    jobId: string;
    status: 'queued' | 'cache_hit';
    cacheHit: boolean;
    plan: MediaPlan;
}

export const MEDIA_PROFILES: TranscodeProfile[] = [
    {
        id: 'roku-hls',
        name: 'Roku HLS',
        target: 'Roku, TV apps',
        container: 'HLS VOD',
        description: 'Four-rung H.264/AAC ladder with conservative Roku playback constraints.',
        segmentSeconds: 6,
        ladder: [
            { name: '1080p', height: 1080, bitrate: '8M', audio_bitrate: '192k' },
            { name: '720p', height: 720, bitrate: '4M', audio_bitrate: '128k' },
            { name: '480p', height: 480, bitrate: '2M', audio_bitrate: '96k' },
            { name: '360p', height: 360, bitrate: '800k', audio_bitrate: '64k' },
        ],
        validationRules: [
            'Master manifest exists',
            'Every variant has media playlist and segments',
            'H.264 video with yuv420p-compatible output',
            'AAC audio present when source has audio',
            'Variant bandwidth and resolution declared',
        ],
        publishHints: ['Prewarm master manifest', 'Prewarm first 3 segments per rendition', 'Serve Roku-specific master URL'],
    },
    {
        id: 'web-hls',
        name: 'Web HLS',
        target: 'Browsers, mobile web',
        container: 'HLS VOD',
        description: 'Balanced web ladder for hls.js and native mobile playback.',
        segmentSeconds: 6,
        ladder: [
            { name: '1080p', height: 1080, bitrate: '6M', audio_bitrate: '160k' },
            { name: '720p', height: 720, bitrate: '3M', audio_bitrate: '128k' },
            { name: '480p', height: 480, bitrate: '1400k', audio_bitrate: '96k' },
            { name: '360p', height: 360, bitrate: '700k', audio_bitrate: '64k' },
        ],
        validationRules: [
            'Playable master manifest',
            'All playlists use relative segment paths',
            'Segment duration variance within tolerance',
            'Audio bitrate declared',
        ],
        publishHints: ['Prewarm master manifest', 'Expose preview player URL', 'Keep original source key linked'],
    },
    {
        id: 'mobile-hls',
        name: 'Mobile HLS',
        target: 'Phones, low bandwidth',
        container: 'HLS VOD',
        description: 'Smaller ladder optimized for startup speed and reduced transfer cost.',
        segmentSeconds: 6,
        ladder: [
            { name: '720p', height: 720, bitrate: '2200k', audio_bitrate: '128k' },
            { name: '480p', height: 480, bitrate: '1200k', audio_bitrate: '96k' },
            { name: '360p', height: 360, bitrate: '550k', audio_bitrate: '64k' },
        ],
        validationRules: [
            'Master manifest exists',
            'No variant exceeds mobile bitrate ceiling',
            'Segments available for every rendition',
            'AAC audio present when source has audio',
        ],
        publishHints: ['Prewarm lowest rendition first', 'Prefer 360p startup on constrained networks'],
    },
];

const PHASES = [
    { id: 'queued', label: 'Queued', progress: 0 },
    { id: 'probing', label: 'Probing source', progress: 12 },
    { id: 'encoding', label: 'Encoding ladder', progress: 48 },
    { id: 'validating', label: 'Validating output', progress: 82 },
    { id: 'publishing', label: 'Publishing streams', progress: 94 },
    { id: 'complete', label: 'Ready', progress: 100 },
];

function safeJsonParse(value: any, fallback: any = undefined) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function serializeHashFields(fields: Record<string, any>) {
    return Object.fromEntries(
        Object.entries(fields)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => {
                if (typeof value === 'string') return [key, value];
                if (typeof value === 'number' || typeof value === 'boolean') return [key, String(value)];
                return [key, JSON.stringify(value)];
            })
    );
}

function hashPayload(payload: Record<string, any>) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function getTranscodeProfiles(): TranscodeProfile[] {
    return MEDIA_PROFILES;
}

export function getTranscodeProfile(profileId?: string): TranscodeProfile {
    return MEDIA_PROFILES.find((profile) => profile.id === profileId) || MEDIA_PROFILES[0];
}

export function buildMediaPlan(inputKey: string, options: Partial<TranscodeJob> & {
    profileId?: string;
    policyVersion?: string;
    ffmpegBuild?: string;
} = {}): MediaPlan {
    const profile = getTranscodeProfile(options.profileId || options.metadata?.profileId);
    const inputBucket = options.input_bucket || DEFAULT_BUCKET;
    const outputBucket = options.output_bucket || DEFAULT_BUCKET;
    const policyVersion = options.policyVersion || options.metadata?.policyVersion || DEFAULT_POLICY_VERSION;
    const ffmpegBuild = options.ffmpegBuild || options.metadata?.ffmpegBuild || DEFAULT_FFMPEG_BUILD;
    const sourceFingerprint = hashPayload({
        bucket: inputBucket,
        key: inputKey,
    }).slice(0, 24);
    const outputPrefix = options.output_prefix || `transcoded/${profile.id}/${sourceFingerprint}`;
    const cacheKey = hashPayload({
        inputBucket,
        inputKey,
        profileId: profile.id,
        ladder: profile.ladder,
        ffmpegBuild,
        policyVersion,
    });

    return {
        profile,
        input: {
            bucket: inputBucket,
            key: inputKey,
            sourceFingerprint,
        },
        output: {
            bucket: outputBucket,
            prefix: outputPrefix,
            masterManifestKey: `${outputPrefix}/master.m3u8`,
            expectedRenditions: profile.ladder.length,
        },
        cache: {
            key: cacheKey,
            policyVersion,
            ffmpegBuild,
            lookupKey: `${CACHE_PREFIX}:${cacheKey}`,
        },
        phases: PHASES,
        validation: {
            rules: profile.validationRules,
            target: profile.target,
        },
        provenance: {
            engine: 'agentcache-media-engine',
            plannedAt: new Date().toISOString(),
            commandShape: [
                'ffmpeg',
                '-i',
                '<source>',
                '-c:v',
                'libx264',
                '-c:a',
                'aac',
                '-f',
                'hls',
                '<variant-playlist>',
            ],
        },
    };
}

async function rememberRecentJob(jobId: string) {
    await redis.lpush(RECENT_JOBS_KEY, jobId);
    await redis.ltrim(RECENT_JOBS_KEY, 0, 49);
}

async function storeJob(jobId: string, fields: Record<string, any>) {
    await redis.hset(`job:${jobId}`, serializeHashFields(fields));
    await redis.expire(`job:${jobId}`, 86400 * 7);
}

async function buildCacheHitJob(inputKey: string, plan: MediaPlan, outputs: any[]): Promise<MediaSubmitResult> {
    const jobId = `job_${Date.now()}_cache_${plan.cache.key.slice(0, 8)}`;
    const now = new Date().toISOString();

    await storeJob(jobId, {
        job_id: jobId,
        status: 'cache_hit',
        phase: 'complete',
        progress: 100,
        input_key: inputKey,
        input_bucket: plan.input.bucket,
        output_bucket: plan.output.bucket,
        output_prefix: plan.output.prefix,
        profile_id: plan.profile.id,
        cache_key: plan.cache.key,
        cache_hit: true,
        outputs,
        validation: {
            status: 'passed',
            checks: plan.validation.rules.map((rule) => ({ rule, status: 'cached' })),
        },
        plan,
        provenance: plan.provenance,
        created_at: now,
        updated_at: now,
    });
    await rememberRecentJob(jobId);

    return {
        jobId,
        status: 'cache_hit',
        cacheHit: true,
        plan,
    };
}

/**
 * Submit a video for transcoding with AgentCache media planning.
 */
export async function submitMediaJob(
    inputKey: string,
    options: Partial<TranscodeJob> & {
        profileId?: string;
        policyVersion?: string;
        ffmpegBuild?: string;
    } = {}
): Promise<MediaSubmitResult> {
    const plan = buildMediaPlan(inputKey, options);
    const cachedOutputs = safeJsonParse(await redis.get(`${plan.cache.lookupKey}:outputs`), null);

    if (!options.output_prefix && Array.isArray(cachedOutputs) && cachedOutputs.length > 0) {
        return buildCacheHitJob(inputKey, plan, cachedOutputs);
    }

    const jobId = await submitTranscodeJob(inputKey, {
        ...options,
        input_bucket: plan.input.bucket,
        output_bucket: plan.output.bucket,
        output_prefix: plan.output.prefix,
        ladder: plan.profile.ladder,
        metadata: {
            ...(options.metadata || {}),
            profileId: plan.profile.id,
            profileName: plan.profile.name,
            cacheKey: plan.cache.key,
            policyVersion: plan.cache.policyVersion,
            ffmpegBuild: plan.cache.ffmpegBuild,
            sourceFingerprint: plan.input.sourceFingerprint,
            plan,
        },
    });

    return {
        jobId,
        status: 'queued',
        cacheHit: false,
        plan,
    };
}

/**
 * Submit a video for transcoding. This lower-level function preserves the
 * existing queue contract used by the Python worker.
 */
export async function submitTranscodeJob(
    inputKey: string,
    options: Partial<TranscodeJob> = {}
): Promise<string> {
    const jobId = options.id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const bucket = DEFAULT_BUCKET;
    const now = new Date().toISOString();
    const metadata = options.metadata || {};
    const profile = getTranscodeProfile(metadata.profileId);

    const job: TranscodeJob = {
        id: jobId,
        input_bucket: options.input_bucket || bucket,
        input_key: inputKey,
        output_bucket: options.output_bucket || bucket,
        output_prefix: options.output_prefix || `transcoded/${jobId}`,
        ladder: options.ladder,
        webhook_url: options.webhook_url,
        watermark: options.watermark,
        metadata,
    };

    await redis.lpush(QUEUE_NAME, JSON.stringify(job));
    await storeJob(jobId, {
        job_id: jobId,
        status: 'queued',
        phase: 'queued',
        progress: 0,
        input_key: inputKey,
        input_bucket: job.input_bucket,
        output_bucket: job.output_bucket,
        output_prefix: job.output_prefix,
        profile_id: metadata.profileId || profile.id,
        profile_name: metadata.profileName || profile.name,
        cache_key: metadata.cacheKey,
        source_fingerprint: metadata.sourceFingerprint,
        plan: metadata.plan,
        provenance: metadata.plan?.provenance,
        created_at: now,
        updated_at: now,
    });
    await rememberRecentJob(jobId);

    return jobId;
}

/**
 * Get job status.
 */
export async function getJobStatus(jobId: string): Promise<{
    jobId?: string;
    status: string;
    phase?: string;
    progress?: number;
    inputKey?: string;
    outputPrefix?: string;
    profileId?: string;
    cacheKey?: string;
    cacheHit?: boolean;
    outputs?: any[];
    error?: string;
    validation?: any;
    probe?: any;
    plan?: MediaPlan;
    provenance?: any;
    createdAt?: string;
    updatedAt?: string;
}> {
    const data = await redis.hgetall(`job:${jobId}`);
    if (!data || Object.keys(data).length === 0) {
        return { status: 'not_found' };
    }

    const outputs = safeJsonParse(data.outputs, undefined);
    const cacheKey = data.cache_key as string | undefined;

    if ((data.status === 'complete' || data.status === 'cache_hit') && cacheKey && Array.isArray(outputs) && outputs.length > 0) {
        await redis.set(`${CACHE_PREFIX}:${cacheKey}:outputs`, JSON.stringify(outputs));
        await redis.expire(`${CACHE_PREFIX}:${cacheKey}:outputs`, 86400 * 30);
    }

    return {
        jobId: (data.job_id as string) || jobId,
        status: (data.status as string) || 'unknown',
        phase: data.phase as string || undefined,
        progress: data.progress !== undefined ? Number(data.progress) : undefined,
        inputKey: data.input_key as string || undefined,
        outputPrefix: data.output_prefix as string || undefined,
        profileId: data.profile_id as string || undefined,
        cacheKey,
        cacheHit: data.cache_hit === 'true' || data.status === 'cache_hit',
        outputs,
        error: data.error as string || undefined,
        validation: safeJsonParse(data.validation, undefined),
        probe: safeJsonParse(data.probe, undefined),
        plan: safeJsonParse(data.plan, undefined),
        provenance: safeJsonParse(data.provenance, undefined),
        createdAt: data.created_at as string || undefined,
        updatedAt: data.updated_at as string || undefined,
    };
}

/**
 * Get recent jobs for the Media Console.
 */
export async function getRecentTranscodeJobs(limit = 20) {
    const ids = (await redis.lrange(RECENT_JOBS_KEY, 0, limit - 1)) as string[];
    const uniqueIds = Array.from(new Set(ids || []));
    const jobs = await Promise.all(uniqueIds.map((jobId) => getJobStatus(jobId)));

    return jobs
        .filter((job) => job.status !== 'not_found')
        .map((job) => ({
            ...job,
            profile: getTranscodeProfile(job.profileId),
        }));
}

/**
 * Get queue length.
 */
export async function getQueueLength(): Promise<number> {
    return await redis.llen(QUEUE_NAME);
}
