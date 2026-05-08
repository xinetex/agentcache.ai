/**
 * VideoCache - HLS Video Caching Layer for AgentCache.ai
 * 
 * Implements tiered video chunk caching using AgentCache's L1/L2/L3 architecture:
 * - L1: Hot segments (in-memory, active playback)
 * - L2: Warm segments (Redis, recent content)
 * - L3: Cold storage (JettyThunder/S3, origin)
 * 
 * Install: npm install ioredis aws-sdk lru-cache
 */

// Lazy load dependencies
let Redis;
let AWS;
const crypto = require('crypto');

function normalizeRedisUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return undefined;
    const trimmed = rawUrl.trim();
    if (!trimmed) return undefined;

    if (trimmed.startsWith('redis://') || trimmed.startsWith('rediss://')) {
        return trimmed;
    }

    return undefined;
}

class SimpleLRU {
    constructor({ max = 100 * 1024 * 1024, maxAge = 5 * 60 * 1000, length = (value) => value?.length || 0 } = {}) {
        this.max = max;
        this.maxAge = maxAge;
        this.length = length;
        this.store = new Map();
        this.totalSize = 0;
    }

    _isExpired(entry) {
        return entry.expiresAt <= Date.now();
    }

    _delete(key) {
        const entry = this.store.get(key);
        if (!entry) return;
        this.totalSize -= entry.size;
        this.store.delete(key);
    }

    _evictIfNeeded() {
        while (this.totalSize > this.max && this.store.size > 0) {
            const oldestKey = this.store.keys().next().value;
            this._delete(oldestKey);
        }
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (this._isExpired(entry)) {
            this._delete(key);
            return null;
        }

        this.store.delete(key);
        this.store.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        const size = this.length(value);
        if (size > this.max) {
            this._delete(key);
            return;
        }

        if (this.store.has(key)) {
            this._delete(key);
        }

        this.store.set(key, {
            value,
            size,
            expiresAt: Date.now() + this.maxAge,
        });
        this.totalSize += size;
        this._evictIfNeeded();
    }

    del(key) {
        this._delete(key);
    }

    reset() {
        this.store.clear();
        this.totalSize = 0;
    }
}

function ensureDependenciesLoaded() {
    if (!Redis) {
        Redis = require('ioredis');
    }
    if (!AWS) {
        AWS = require('aws-sdk');
    }
}

class VideoCache {
    constructor(config = {}) {
        ensureDependenciesLoaded();

        // Configuration
        this.config = {
            // L1: In-memory LRU cache
            l1MaxSize: config.l1MaxSize || 100 * 1024 * 1024, // 100MB
            l1MaxAge: config.l1MaxAge || 5 * 60 * 1000,       // 5 minutes

            // L2: Redis cache
            redisUrl: normalizeRedisUrl(config.redisUrl || process.env.REDIS_URL || process.env.KV_URL),
            l2TTL: config.l2TTL || 3600,                      // 1 hour

            // L3: S3/JettyThunder origin
            s3Endpoint: config.s3Endpoint || process.env.S3_ENDPOINT || 'https://s3.us-west-1.lyvecloud.seagate.com',
            s3AccessKey: config.s3AccessKey || process.env.S3_ACCESS_KEY,
            s3SecretKey: config.s3SecretKey || process.env.S3_SECRET_KEY,
            s3Bucket: config.s3Bucket || process.env.S3_BUCKET || 'jettydata-prod',
            s3Region: config.s3Region || process.env.S3_REGION || 'us-west-1',

            // Warm deduplication
            recentWarmTtl: config.recentWarmTtl || parseInt(process.env.CDN_RECENT_WARM_TTL || '', 10) || 15 * 60,

            // Metrics
            enableMetrics: config.enableMetrics !== false
        };

        // L1: In-memory LRU
        this.l1 = new SimpleLRU({
            max: this.config.l1MaxSize,
            length: (value) => value.length,
            maxAge: this.config.l1MaxAge
        });

        this.metrics = {
            totalRequests: 0,
            l1Hits: 0,
            l2Hits: 0,
            l3Hits: 0,
            misses: 0,
        };

        // Computed properties for lazy loading
        this._l2 = null;
        this._l3 = null;
        this._recentWarmMarkers = new Map();
    }

    get l2() {
        if (!this._l2 && this.config.redisUrl) {
            this._l2 = new Redis(this.config.redisUrl, {
                lazyConnect: true,
                connectTimeout: 1000,
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
            });
            // Suppress error listeners on Vercel to avoid event loop hang
            if (!process.env.VERCEL) {
                this._l2.on('error', (err) => console.error('VideoCache L2 Redis error:', err));
            } else {
                this._l2.on('error', () => { }); // No-op
            }
        }
        return this._l2;
    }

    get l3() {
        if (!this._l3 && this.config.s3Endpoint) {
            this._l3 = new AWS.S3({
                endpoint: this.config.s3Endpoint,
                accessKeyId: this.config.s3AccessKey,
                secretAccessKey: this.config.s3SecretKey,
                s3ForcePathStyle: true,
                signatureVersion: 'v4',
                region: this.config.s3Region,
                httpOptions: { timeout: 5000 } // Fail fast
            });
        }
        return this._l3;
    }

    /**
     * Generate cache key from video path
     */
    _getCacheKey(videoPath) {
        return `videocache:${crypto.createHash('md5').update(videoPath).digest('hex')}`;
    }

    _getWarmMarkerKey(videoPath) {
        return `videocache:warm:${crypto.createHash('md5').update(videoPath).digest('hex')}`;
    }

    _hasLocalWarmMarker(markerKey) {
        const expiresAt = this._recentWarmMarkers.get(markerKey);
        if (!expiresAt) return false;
        if (expiresAt <= Date.now()) {
            this._recentWarmMarkers.delete(markerKey);
            return false;
        }
        return true;
    }

    _setLocalWarmMarker(markerKey) {
        this._recentWarmMarkers.set(markerKey, Date.now() + this.config.recentWarmTtl * 1000);
    }

    async _wasRecentlyWarmed(videoPath) {
        const markerKey = this._getWarmMarkerKey(videoPath);
        if (this._hasLocalWarmMarker(markerKey)) {
            return true;
        }

        if (this.l2) {
            try {
                const marker = await this.l2.get(markerKey);
                if (marker) {
                    this._setLocalWarmMarker(markerKey);
                    return true;
                }
            } catch (err) {
                console.warn('VideoCache warm-marker get error:', err.message);
                this._l2 = null;
            }
        }

        return false;
    }

    async _markRecentlyWarmed(videoPath) {
        const markerKey = this._getWarmMarkerKey(videoPath);
        this._setLocalWarmMarker(markerKey);

        if (this.l2) {
            try {
                await this.l2.setex(markerKey, this.config.recentWarmTtl, '1');
            } catch (err) {
                console.warn('VideoCache warm-marker set error:', err.message);
                this._l2 = null;
            }
        }
    }

    /**
     * Get video segment from cache (L1 → L2 → L3)
     * @param {string} videoPath - Path to video segment (e.g., "hls/job123/720p/segment_001.ts")
     * @returns {Promise<Buffer|null>} - Video segment data
     */
    async get(videoPath) {
        this.metrics.totalRequests++;
        const cacheKey = this._getCacheKey(videoPath);

        // L1: Check in-memory cache
        const l1Data = this.l1.get(cacheKey);
        if (l1Data) {
            this.metrics.l1Hits++;
            return l1Data;
        }

        // L2: Check Redis cache
        if (this.l2) {
            try {
                const l2Data = await this.l2.getBuffer(cacheKey);
                if (l2Data) {
                    this.metrics.l2Hits++;
                    // Promote to L1
                    this.l1.set(cacheKey, l2Data);
                    return l2Data;
                }
            } catch (err) {
                console.warn('VideoCache L2 get error:', err.message);
                this._l2 = null;
            }
        }

        // L3: Fetch from S3/JettyThunder
        if (this.l3) {
            try {
                const params = {
                    Bucket: this.config.s3Bucket,
                    Key: videoPath
                };
                const s3Response = await this.l3.getObject(params).promise();
                const l3Data = s3Response.Body;

                this.metrics.l3Hits++;

                // Promote to L2 and L1
                await this._promoteToCache(cacheKey, l3Data);

                return l3Data;
            } catch (err) {
                if (err.code !== 'NoSuchKey') {
                    console.warn('VideoCache L3 get error:', err.message);
                }
            }
        }

        this.metrics.misses++;
        return null;
    }

    /**
     * Promote data to L1 and L2 caches
     */
    async _promoteToCache(cacheKey, data) {
        // L1: In-memory
        this.l1.set(cacheKey, data);

        // L2: Redis (async, don't wait)
        if (this.l2) {
            this.l2.setex(cacheKey, this.config.l2TTL, data).catch((err) => {
                console.warn('VideoCache L2 set error:', err.message);
                this._l2 = null;
            });
        }
    }

    /**
     * Store video segment directly (bypass origin)
     */
    async set(videoPath, data, options = {}) {
        const cacheKey = this._getCacheKey(videoPath);
        const ttl = options.ttl || this.config.l2TTL;

        // L1
        this.l1.set(cacheKey, data);

        // L2
        if (this.l2) {
            try {
                await this.l2.setex(cacheKey, ttl, data);
            } catch (err) {
                console.warn('VideoCache L2 set error:', err.message);
                this._l2 = null;
            }
        }

        // L3 (optional - only if explicitly requested)
        if (options.persistToOrigin && this.l3) {
            const contentType = videoPath.endsWith('.m3u8')
                ? 'application/x-mpegURL'
                : 'video/MP2T';

            await this.l3.upload({
                Bucket: this.config.s3Bucket,
                Key: videoPath,
                Body: data,
                ContentType: contentType,
                ACL: 'public-read'
            }).promise();
        }
    }

    /**
     * Invalidate cache for a video path
     */
    async invalidate(videoPath) {
        const cacheKey = this._getCacheKey(videoPath);
        const markerKey = this._getWarmMarkerKey(videoPath);

        this.l1.del(cacheKey);
        this._recentWarmMarkers.delete(markerKey);

        if (this.l2) {
            try {
                await this.l2.del(cacheKey);
                await this.l2.del(markerKey);
            } catch (err) {
                console.warn('VideoCache L2 delete error:', err.message);
                this._l2 = null;
            }
        }
    }

    /**
     * Invalidate all segments for a job
     */
    async invalidateJob(jobId) {
        // L1: Clear all keys matching pattern
        const pattern = `videocache:*`;
        // LRU doesn't support pattern deletion, would need to track keys

        // L2: Use Redis SCAN to find and delete
        if (this.l2) {
            const stream = this.l2.scanStream({
                match: `videocache:*`,
                count: 100
            });

            stream.on('data', async (keys) => {
                if (keys.length) {
                    await this.l2.del(...keys);
                }
            });
        }
    }

    /**
     * Warm cache with HLS playlist segments
     */
    async warmPlaylist(playlistPath) {
        console.log(`🔥 Warming cache for: ${playlistPath}`);

        if (await this._wasRecentlyWarmed(playlistPath)) {
            console.log(`  ↺ Skipping recent warm: ${playlistPath}`);
            return { playlistPath, skipped: true, reason: 'recently_warmed', segmentsWarmed: 0 };
        }

        // Fetch and cache the playlist itself
        const playlist = await this.get(playlistPath);
        if (!playlist) {
            console.warn(`  ✗ Playlist not found: ${playlistPath}`);
            return { playlistPath, skipped: true, reason: 'missing_playlist', segmentsWarmed: 0 };
        }

        // Parse M3U8 to find segment URLs
        const playlistStr = playlist.toString('utf8');
        const lines = playlistStr.split('\n');
        const segments = lines.filter(line => line.endsWith('.ts'));

        const basePath = playlistPath.substring(0, playlistPath.lastIndexOf('/'));

        console.log(`  📥 Warming ${segments.length} segments...`);

        let segmentsWarmed = 0;
        for (const segment of segments) {
            const segmentPath = `${basePath}/${segment}`;
            const warmed = await this.warmPath(segmentPath);
            if (warmed.warmed) segmentsWarmed++;
        }

        await this._markRecentlyWarmed(playlistPath);

        console.log(`  ✅ Cache warmed for ${playlistPath}`);
        return { playlistPath, skipped: false, segmentsWarmed };
    }

    async warmPath(videoPath) {
        if (await this._wasRecentlyWarmed(videoPath)) {
            return { path: videoPath, warmed: false, skipped: true, reason: 'recently_warmed' };
        }

        const data = await this.get(videoPath);
        if (!data) {
            return { path: videoPath, warmed: false, skipped: true, reason: 'missing' };
        }

        await this._markRecentlyWarmed(videoPath);
        return { path: videoPath, warmed: true, skipped: false };
    }

    /**
     * Get cache metrics
     */
    getMetrics() {
        const total = this.metrics.totalRequests || 1;
        return {
            ...this.metrics,
            l1HitRate: (this.metrics.l1Hits / total * 100).toFixed(2) + '%',
            l2HitRate: (this.metrics.l2Hits / total * 100).toFixed(2) + '%',
            l3HitRate: (this.metrics.l3Hits / total * 100).toFixed(2) + '%',
            missRate: (this.metrics.misses / total * 100).toFixed(2) + '%',
            cacheHitRate: ((total - this.metrics.misses) / total * 100).toFixed(2) + '%'
        };
    }

    /**
     * Shutdown cleanly
     */
    async shutdown() {
        if (this.l2) {
            await this.l2.quit();
        }
        this.l1.reset();
        console.log('VideoCache shutdown complete');
    }
}

// Express middleware for serving cached video segments
function videoCacheMiddleware(videoCache, options = {}) {
    const basePath = options.basePath || '/hls';

    return async (req, res, next) => {
        // Only handle HLS requests
        if (!req.path.startsWith(basePath)) {
            return next();
        }

        const videoPath = req.path.substring(basePath.length + 1);

        try {
            const data = await videoCache.get(videoPath);

            if (data) {
                // Set appropriate content type
                if (videoPath.endsWith('.m3u8')) {
                    res.set('Content-Type', 'application/x-mpegURL');
                } else if (videoPath.endsWith('.ts')) {
                    res.set('Content-Type', 'video/MP2T');
                }

                // Set caching headers
                res.set('Cache-Control', 'public, max-age=31536000');
                res.set('X-VideoCache', 'HIT');

                return res.send(data);
            }

            res.set('X-VideoCache', 'MISS');
            next();
        } catch (err) {
            console.error('VideoCache middleware error:', err);
            next();
        }
    };
}

// Singleton instance
let defaultInstance = null;

function getVideoCache(config) {
    if (!defaultInstance) {
        defaultInstance = new VideoCache(config);
    }
    return defaultInstance;
}

module.exports = {
    VideoCache,
    videoCacheMiddleware,
    getVideoCache
};
