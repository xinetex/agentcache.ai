/**
 * Audio1.TV CDN Client SDK
 * 
 * Standalone client for integrating with AgentCache CDN services.
 * Works in browsers, Node.js, React Native, and Roku (BrightScript adapter available).
 * 
 * @example
 * // Browser/Node.js
 * import { Audio1CDN } from './audio1-cdn-client.js';
 * 
 * const cdn = new Audio1CDN({ baseUrl: 'https://agentcache.ai' });
 * const streamUrl = cdn.getStreamUrl('video-123', '720p');
 * 
 * // Warm cache before premiere
 * await cdn.warmCache('video-123', '1080p');
 */

class Audio1CDN {
    /**
     * Create a new Audio1CDN client
     * @param {Object} config - Configuration options
     * @param {string} config.baseUrl - Base URL of the AgentCache CDN (default: https://agentcache.ai)
     * @param {string} [config.apiKey] - Optional API key for authenticated endpoints
     * @param {number} [config.timeout] - Request timeout in ms (default: 30000)
     */
    constructor(config = {}) {
        this.baseUrl = (config.baseUrl || 'https://agentcache.ai').replace(/\/$/, '');
        this.apiKey = config.apiKey || null;
        this.timeout = config.timeout || 30000;
    }

    /**
     * Get HLS playlist URL for a video
     * @param {string} jobId - The transcode job ID
     * @param {string} [quality='720p'] - Video quality (360p, 480p, 720p, 1080p)
     * @returns {string} The HLS playlist URL
     */
    getPlaylistUrl(jobId, quality = '720p') {
        return `${this.baseUrl}/hls/${jobId}/${quality}/playlist.m3u8`;
    }

    /**
     * Get direct stream URL for a specific segment
     * @param {string} jobId - The transcode job ID
     * @param {string} quality - Video quality
     * @param {string} segment - Segment filename (e.g., 'segment_001.ts')
     * @returns {string} The segment URL
     */
    getSegmentUrl(jobId, quality, segment) {
        return `${this.baseUrl}/hls/${jobId}/${quality}/${segment}`;
    }

    /**
     * Get adaptive bitrate master playlist URL
     * @param {string} jobId - The transcode job ID
     * @returns {string} The master playlist URL
     */
    getMasterPlaylistUrl(jobId) {
        return `${this.baseUrl}/hls/${jobId}/master.m3u8`;
    }

    /**
     * Warm the cache for a video (call before premiere/popular content)
     * @param {string} jobId - The transcode job ID
     * @param {string} [quality='720p'] - Quality to warm
     * @returns {Promise<Object>} Warm result
     */
    async warmCache(jobId, quality = '720p') {
        const response = await this._fetch('/api/cdn/warm', {
            method: 'POST',
            body: JSON.stringify({ jobId, quality })
        });
        return response;
    }

    /**
     * Warm all quality levels for a video
     * @param {string} jobId - The transcode job ID
     * @param {string[]} [qualities=['360p', '480p', '720p', '1080p']] - Qualities to warm
     * @returns {Promise<Object[]>} Array of warm results
     */
    async warmAllQualities(jobId, qualities = ['360p', '480p', '720p', '1080p']) {
        const results = await Promise.all(
            qualities.map(quality => this.warmCache(jobId, quality))
        );
        return results;
    }

    /**
     * Invalidate cache for a video (call after update/delete)
     * @param {string} jobId - The transcode job ID to invalidate
     * @returns {Promise<Object>} Invalidation result
     */
    async invalidateCache(jobId) {
        const response = await this._fetch('/api/cdn/invalidate', {
            method: 'POST',
            body: JSON.stringify({ jobId })
        });
        return response;
    }

    /**
     * Invalidate a specific path
     * @param {string} path - The path to invalidate (e.g., 'hls/job123/720p/segment_001.ts')
     * @returns {Promise<Object>} Invalidation result
     */
    async invalidatePath(path) {
        const response = await this._fetch('/api/cdn/invalidate', {
            method: 'POST',
            body: JSON.stringify({ path })
        });
        return response;
    }

    /**
     * Get CDN cache metrics
     * @returns {Promise<Object>} Cache metrics including hit rates
     */
    async getMetrics() {
        const response = await this._fetch('/api/cdn/metrics', {
            method: 'GET'
        });
        return response;
    }

    /**
     * Check if CDN is healthy and responsive
     * @returns {Promise<boolean>} True if healthy
     */
    async healthCheck() {
        try {
            const metrics = await this.getMetrics();
            return metrics.success === true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Internal fetch wrapper with timeout and error handling
     * @private
     */
    async _fetch(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...headers, ...options.headers },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
}

/**
 * Quality presets for common use cases
 */
const QualityPresets = {
    MOBILE: '360p',
    SD: '480p',
    HD: '720p',
    FULL_HD: '1080p',

    // Adaptive - returns all qualities for ABR
    ADAPTIVE: ['360p', '480p', '720p', '1080p']
};

/**
 * Helper to detect optimal quality based on connection
 * @returns {string} Recommended quality
 */
function detectOptimalQuality() {
    if (typeof navigator === 'undefined') return '720p';

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return '720p';

    const effectiveType = connection.effectiveType;
    switch (effectiveType) {
        case 'slow-2g':
        case '2g':
            return '360p';
        case '3g':
            return '480p';
        case '4g':
        default:
            return '720p';
    }
}

/**
 * Create a video player configuration object
 * @param {Audio1CDN} cdn - CDN client instance
 * @param {string} jobId - Video job ID
 * @param {Object} [options] - Player options
 * @returns {Object} Player configuration
 */
function createPlayerConfig(cdn, jobId, options = {}) {
    const quality = options.quality || detectOptimalQuality();

    return {
        // HLS.js / Video.js config
        src: cdn.getPlaylistUrl(jobId, quality),
        type: 'application/x-mpegURL',

        // For adaptive streaming
        masterPlaylist: cdn.getMasterPlaylistUrl(jobId),

        // Metadata
        jobId,
        quality,

        // Player hints
        autoplay: options.autoplay || false,
        muted: options.muted || false,
        controls: options.controls !== false,

        // CDN reference for dynamic operations
        cdn
    };
}

// Export for different module systems (UMD pattern)
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        // CommonJS (Node.js)
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(factory);
    } else {
        // Browser global
        const exports = factory();
        root.Audio1CDN = exports.Audio1CDN;
        root.QualityPresets = exports.QualityPresets;
        root.detectOptimalQuality = exports.detectOptimalQuality;
        root.createPlayerConfig = exports.createPlayerConfig;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    return { Audio1CDN, QualityPresets, detectOptimalQuality, createPlayerConfig };
}));
