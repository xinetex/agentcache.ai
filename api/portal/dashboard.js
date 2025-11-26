import { requireAuth } from '../../lib/auth-middleware.js';
import { query } from '../../lib/db.js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication and get user
    const user = await requireAuth(req, res);
    if (!user) return; // requireAuth already sent error response

    const organizationId = user.organizationId;

    // Fetch organization details
    const orgResult = await query(
      'SELECT id, name, slug, sector, plan_tier, created_at FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const organization = orgResult.rows[0];

    // Fetch namespaces
    const namespacesResult = await query(
      'SELECT id, name, sector_nodes, created_at FROM namespaces WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );

    // Fetch API keys
    const apiKeysResult = await query(
      'SELECT id, key, created_at, last_used_at FROM api_keys WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );

    // Calculate cache metrics from Redis
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    
    // Get usage metrics from database (last 24h)
    const metricsResult = await query(
      `SELECT 
        SUM(total_requests) as total_requests,
        SUM(cache_hits) as cache_hits,
        SUM(cache_misses) as cache_misses,
        SUM(bandwidth_saved_bytes) as bandwidth_saved
       FROM organization_usage_metrics 
       WHERE organization_id = $1 
       AND date >= CURRENT_DATE - INTERVAL '1 day'`,
      [organizationId]
    );

    const metricsRow = metricsResult.rows[0] || {};
    const totalRequests = parseInt(metricsRow.total_requests) || 0;
    const cacheHits = parseInt(metricsRow.cache_hits) || 0;
    const cacheMisses = parseInt(metricsRow.cache_misses) || 0;
    const bandwidthSavedBytes = parseInt(metricsRow.bandwidth_saved) || 0;

    const hitRate = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;
    const bandwidthSavedGB = (bandwidthSavedBytes / (1024 * 1024 * 1024)).toFixed(2);

    // Calculate cost savings (example: $0.09/GB egress)
    const costSavings = Math.round(bandwidthSavedBytes / (1024 * 1024 * 1024) * 0.09);

    // Fetch dedup metrics for filestorage sector
    let dedupMetrics = null;
    if (organization.sector === 'filestorage') {
      try {
        // Get dedup savings from the dedup-savings endpoint logic
        const dedupStatsKeys = await redis.keys(`dedup:stats:*`);
        let totalOriginalSize = 0;
        let totalDedupSize = 0;
        let dedupCount = 0;

        for (const key of dedupStatsKeys) {
          const stats = await redis.hgetall(key);
          if (stats && stats.refCount > 1) {
            const contentSize = parseInt(stats.contentSize) || 0;
            const refCount = parseInt(stats.refCount) || 1;
            totalOriginalSize += contentSize * refCount;
            totalDedupSize += contentSize;
            dedupCount++;
          }
        }

        const savedBytes = totalOriginalSize - totalDedupSize;
        const dedupRate = totalOriginalSize > 0 
          ? Math.round((savedBytes / totalOriginalSize) * 100) 
          : 0;
        
        // Monthly savings projection (Seagate Lyve: $0.09/GB egress + $0.005/GB storage)
        const monthlySavings = Math.round((savedBytes / (1024 * 1024 * 1024)) * 0.095);

        dedupMetrics = {
          dedupRate,
          monthlySavings,
          totalFiles: dedupStatsKeys.length,
          duplicatesEliminated: dedupCount
        };
      } catch (dedupErr) {
        console.error('Error calculating dedup metrics:', dedupErr);
        dedupMetrics = { dedupRate: 0, monthlySavings: 0 };
      }
    }

    return res.status(200).json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        sector: organization.sector,
        planTier: organization.plan_tier,
        createdAt: organization.created_at
      },
      metrics: {
        hitRate,
        totalRequests,
        cacheHits,
        cacheMisses,
        bandwidthSaved: `${bandwidthSavedGB} GB`,
        costSavings
      },
      namespaces: namespacesResult.rows,
      apiKeys: apiKeysResult.rows,
      dedupMetrics
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
