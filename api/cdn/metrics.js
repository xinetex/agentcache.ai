/**
 * CDN Metrics Handler - Cache Performance Analytics
 * 
 * Returns cache hit/miss statistics for monitoring and optimization.
 */

import { getVideoCache } from '../../transcoder-service/videocache.js';

export default async function handler(req) {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        // Get the VideoCache instance (may not be initialized if no requests made yet)
        let metrics = {
            l1Hits: 0,
            l2Hits: 0,
            l3Hits: 0,
            misses: 0,
            totalRequests: 0,
            l1HitRate: '0.00%',
            l2HitRate: '0.00%',
            l3HitRate: '0.00%',
            missRate: '0.00%',
            cacheHitRate: '0.00%',
            status: 'not_initialized'
        };

        try {
            const cache = getVideoCache();
            if (cache && cache.getMetrics) {
                metrics = {
                    ...cache.getMetrics(),
                    status: 'active'
                };
            }
        } catch (e) {
            // Cache not yet initialized
            metrics.status = 'not_initialized';
        }

        return new Response(JSON.stringify({
            success: true,
            service: 'Audio1.TV CDN',
            timestamp: new Date().toISOString(),
            metrics,
            tiers: {
                l1: {
                    type: 'in-memory',
                    maxSize: process.env.CDN_L1_MAX_SIZE || '100MB',
                    ttl: process.env.CDN_L1_TTL || '5 minutes'
                },
                l2: {
                    type: 'redis',
                    connected: !!process.env.REDIS_URL || !!process.env.KV_URL,
                    ttl: process.env.CDN_L2_TTL || '1 hour'
                },
                l3: {
                    type: 'jettythunder',
                    bucket: process.env.JETTYTHUNDER_BUCKET || 'audio1-videos',
                    connected: !!process.env.JETTYTHUNDER_S3_ENDPOINT || !!process.env.S3_ENDPOINT
                }
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('CDN metrics error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to get metrics',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
