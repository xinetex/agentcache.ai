export const config = { runtime: 'nodejs' };

import { requireAuth, withAuth } from '../../lib/auth-middleware.js';
import { calculateDedupSavings, getPlatformDedupStats } from '../../lib/filestorage-dedup.js';
import { Redis } from '@upstash/redis';
import { createClient } from '@vercel/postgres';

/**
 * GET /api/portal/dedup-savings
 * Get file deduplication savings for customer's organization
 * 
 * Query params:
 *   ?namespace=optional - Filter by specific namespace
 *   ?period=7d|30d|90d - Time period (default: 30d)
 * 
 * Response:
 * {
 *   success: true,
 *   savings: {
 *     totalOriginalSize, totalDedupSize, savedBytes, savedPercentage,
 *     savedGB, savedCost, totalHits, uniqueHashes
 *   }
 * }
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}

async function handleRequest(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'GET') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  // Verify authentication
  const user = await requireAuth(req);

  if (!user.organizationId) {
    return json({
      success: false,
      error: 'No organization associated with user'
    }, 403);
  }

  // Parse query parameters
  const url = new URL(req.url);
  const namespace = url.searchParams.get('namespace');
  const period = url.searchParams.get('period') || '30d';

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const db = createClient();

  try {
    // Get organization's namespaces
    await db.connect();
    
    const namespacesResult = await db.query(`
      SELECT name FROM namespaces
      WHERE organization_id = $1 AND is_active = true
    `, [user.organizationId]);

    if (namespacesResult.rows.length === 0) {
      return json({
        success: true,
        savings: {
          totalOriginalSize: 0,
          totalDedupSize: 0,
          savedBytes: 0,
          savedPercentage: 0,
          savedGB: '0.00',
          savedCost: '0.00',
          totalHits: 0,
          uniqueHashes: 0,
        },
        message: 'No namespaces found for organization',
      });
    }

    const orgNamespaces = namespacesResult.rows.map(r => r.name);

    // If specific namespace requested, validate it belongs to org
    if (namespace && !orgNamespaces.includes(namespace)) {
      return json({
        success: false,
        error: 'Namespace not found or access denied'
      }, 403);
    }

    // Calculate savings for requested namespaces
    const namespacesToQuery = namespace ? [namespace] : orgNamespaces;
    
    let aggregatedSavings = {
      totalOriginalSize: 0,
      totalDedupSize: 0,
      savedBytes: 0,
      totalHits: 0,
      uniqueHashes: 0,
    };

    const namespaceBreakdown = [];

    for (const ns of namespacesToQuery) {
      const savings = await calculateDedupSavings(ns, redis, db);
      
      if (savings) {
        aggregatedSavings.totalOriginalSize += savings.totalOriginalSize;
        aggregatedSavings.totalDedupSize += savings.totalDedupSize;
        aggregatedSavings.savedBytes += savings.savedBytes;
        aggregatedSavings.totalHits += savings.totalHits;
        aggregatedSavings.uniqueHashes += savings.uniqueHashes;

        namespaceBreakdown.push({
          namespace: ns,
          savedBytes: savings.savedBytes,
          savedPercentage: savings.savedPercentage,
          savedCost: savings.savedCost,
          totalHits: savings.totalHits,
        });
      }
    }

    // Calculate final percentages and costs
    const savedPercentage = aggregatedSavings.totalOriginalSize > 0
      ? ((aggregatedSavings.savedBytes / aggregatedSavings.totalOriginalSize) * 100).toFixed(2)
      : 0;

    const savedGB = (aggregatedSavings.savedBytes / (1024 * 1024 * 1024)).toFixed(2);
    const savedCost = (parseFloat(savedGB) * 0.005).toFixed(2); // Lyve: $0.005/GB

    return json({
      success: true,
      period,
      organizationId: user.organizationId,
      savings: {
        totalOriginalSize: aggregatedSavings.totalOriginalSize,
        totalDedupSize: aggregatedSavings.totalDedupSize,
        savedBytes: aggregatedSavings.savedBytes,
        savedPercentage: parseFloat(savedPercentage),
        savedGB,
        savedCost,
        totalHits: aggregatedSavings.totalHits,
        uniqueHashes: aggregatedSavings.uniqueHashes,
      },
      breakdown: namespaceBreakdown,
      metrics: {
        averageHitsPerFile: aggregatedSavings.uniqueHashes > 0
          ? (aggregatedSavings.totalHits / aggregatedSavings.uniqueHashes).toFixed(2)
          : 0,
        dedupEfficiency: savedPercentage,
        projectedMonthlySavings: (parseFloat(savedCost) * 30).toFixed(2), // Extrapolate to month
      },
    });

  } catch (error) {
    console.error('Dedup savings calculation error:', error);

    return json({
      success: false,
      error: 'Failed to calculate deduplication savings',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);

  } finally {
    await db.end();
  }
}

export default withAuth(handleRequest);
