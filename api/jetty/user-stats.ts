import { Redis } from '@upstash/redis';
import { jettySpeedDb } from '../../src/services/jettySpeedDb';

export const config = {
  runtime: 'nodejs',
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface UserStatsResponse {
  period: string;
  userId: string;
  timestamp: string;
  connection: {
    status: 'connected' | 'degraded' | 'offline';
    active_edges: Array<{
      id: string;
      city: string;
      latency_ms: number;
      utilization_percent: number;
    }>;
    average_latency_ms: number;
  };
  file_transfers: {
    total_uploads: number;
    total_downloads: number;
    active_transfers: Array<{
      session_id: string;
      file_name: string;
      file_size: number;
      progress_percent: number;
      speed_mbps: number;
      edges_used: string[];
      started_at: string;
    }>;
    recent_activity: Array<{
      timestamp: string;
      type: 'upload' | 'download';
      file_name: string;
      file_size: number;
      duration_seconds: number;
      speed_multiplier: number;
      cache_hit: boolean;
      edges_used: string[];
    }>;
  };
  performance: {
    cache_hit_rate_percent: number;
    bandwidth_saved_gb: number;
    average_download_ms: number;
    upload_acceleration: number; // multiplier e.g. 3.8x
  };
  cache_status: {
    cached_files: number;
    cached_chunks: number;
    total_cached_size_gb: number;
    files: Array<{
      file_id: string;
      file_name: string;
      cached_chunks: number;
      total_chunks: number;
      ttl_hours: number;
    }>;
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const period = url.searchParams.get('period') || '24h'; // 1h, 24h, 7d, 30d

    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameter: userId' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate time window
    const now = new Date();
    let hours: number;
    switch (period) {
      case '1h': hours = 1; break;
      case '24h': hours = 24; break;
      case '7d': hours = 24 * 7; break;
      case '30d': hours = 24 * 30; break;
      default: hours = 24;
    }

    // 1. CONNECTION STATUS - Get active edges for this user
    const activeSessionsKey = `jetty:user:${userId}:sessions`;
    const activeSessionIds = await redis.smembers(activeSessionsKey) as string[];
    
    let activeEdges: Array<{ id: string; city: string; latency_ms: number; utilization_percent: number }> = [];
    if (activeSessionIds.length > 0) {
      // Get edge data from the most recent session
      const latestSessionKey = `jetty:session:${activeSessionIds[0]}`;
      const sessionData = await redis.get(latestSessionKey);
      
      if (sessionData) {
        const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        // Fetch edge performance data
        const edgeIds = session.edgesUsed || [];
        
        for (const edgeId of edgeIds) {
          const edgeMetricKey = `jetty:edge:${edgeId}:metrics`;
          const metrics = await redis.hgetall(edgeMetricKey) as Record<string, string> | null;
          
          if (metrics) {
            activeEdges.push({
              id: edgeId,
              city: metrics.city || edgeId,
              latency_ms: parseInt(metrics.latency_ms || '50'),
              utilization_percent: parseInt(metrics.utilization_percent || '0'),
            });
          }
        }
      }
    }

    const averageLatency = activeEdges.length > 0
      ? activeEdges.reduce((sum, e) => sum + e.latency_ms, 0) / activeEdges.length
      : 0;

    const connectionStatus = activeEdges.length === 0 
      ? 'offline' 
      : averageLatency > 100 
        ? 'degraded' 
        : 'connected';

    // 2. FILE TRANSFERS - Get active and recent transfers
    const activeTransfers = [];
    for (const sessionId of activeSessionIds.slice(0, 10)) { // Limit to 10 most recent
      const sessionKey = `jetty:session:${sessionId}`;
      const sessionData = await redis.get(sessionKey);
      
      if (sessionData) {
        const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        
        if (session.status === 'in_progress') {
          const progressPercent = session.chunksTotal > 0
            ? (session.chunksCompleted / session.chunksTotal) * 100
            : 0;
          
          const elapsedMs = new Date().getTime() - new Date(session.startedAt).getTime();
          const speedMbps = elapsedMs > 0
            ? (session.bytesUploaded / 1024 / 1024) / (elapsedMs / 1000)
            : 0;

          activeTransfers.push({
            session_id: sessionId,
            file_name: session.fileName,
            file_size: session.fileSize,
            progress_percent: Math.round(progressPercent),
            speed_mbps: parseFloat(speedMbps.toFixed(2)),
            edges_used: session.edgesUsed || [],
            started_at: session.startedAt,
          });
        }
      }
    }

    // Get recent completed uploads from database
    const recentUploads = await jettySpeedDb.getRecentUploads(userId, 10);
    
    const recentActivity = recentUploads.map((upload: any) => ({
      timestamp: upload.completed_at,
      type: 'upload' as const,
      file_name: upload.file_name,
      file_size: upload.file_size,
      duration_seconds: upload.duration_seconds,
      speed_multiplier: upload.speed_multiplier || 1.0,
      cache_hit: false,
      edges_used: upload.edges_used || [],
    }));

    // 3. PERFORMANCE METRICS
    const performanceKey = `jetty:user:${userId}:performance`;
    const performanceData = await redis.hgetall(performanceKey) as Record<string, string> | null;
    
    const cacheHitRate = performanceData?.cache_hit_rate_percent 
      ? parseFloat(performanceData.cache_hit_rate_percent)
      : 0;
    const bandwidthSaved = performanceData?.bandwidth_saved_gb
      ? parseFloat(performanceData.bandwidth_saved_gb)
      : 0;
    const avgDownload = performanceData?.average_download_ms
      ? parseInt(performanceData.average_download_ms)
      : 0;
    const uploadAccel = performanceData?.upload_acceleration
      ? parseFloat(performanceData.upload_acceleration)
      : 1.0;

    // 4. CACHE STATUS - Get cached files for this user
    const cachedFilesKey = `jetty:user:${userId}:cached_files`;
    const cachedFileIds = await redis.smembers(cachedFilesKey) as string[];
    
    const cachedFiles = [];
    let totalCachedSizeBytes = 0;
    let totalCachedChunks = 0;

    for (const fileId of cachedFileIds.slice(0, 20)) { // Limit to 20 most recent
      const fileKey = `jetty:file:${fileId}:cache`;
      const fileData = await redis.hgetall(fileKey) as Record<string, string> | null;
      
      if (fileData) {
        const cachedChunks = parseInt(fileData.cached_chunks || '0');
        const totalChunks = parseInt(fileData.total_chunks || '0');
        const fileSizeBytes = parseInt(fileData.file_size || '0');
        const ttlSeconds = await redis.ttl(`jetty:file:${fileId}:cache`);
        
        totalCachedSizeBytes += fileSizeBytes;
        totalCachedChunks += cachedChunks;

        cachedFiles.push({
          file_id: fileId,
          file_name: fileData.file_name || 'Unknown',
          cached_chunks: cachedChunks,
          total_chunks: totalChunks,
          ttl_hours: ttlSeconds > 0 ? Math.round(ttlSeconds / 3600) : 0,
        });
      }
    }

    // Build response
    const stats: UserStatsResponse = {
      period,
      userId,
      timestamp: now.toISOString(),
      connection: {
        status: connectionStatus,
        active_edges: activeEdges,
        average_latency_ms: Math.round(averageLatency),
      },
      file_transfers: {
        total_uploads: recentUploads.length,
        total_downloads: 0, // TODO: Track downloads separately
        active_transfers: activeTransfers,
        recent_activity: recentActivity,
      },
      performance: {
        cache_hit_rate_percent: Math.round(cacheHitRate * 100) / 100,
        bandwidth_saved_gb: Math.round(bandwidthSaved * 100) / 100,
        average_download_ms: avgDownload,
        upload_acceleration: uploadAccel,
      },
      cache_status: {
        cached_files: cachedFileIds.length,
        cached_chunks: totalCachedChunks,
        total_cached_size_gb: Math.round((totalCachedSizeBytes / 1024 / 1024 / 1024) * 100) / 100,
        files: cachedFiles,
      },
    };

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error: any) {
    console.error('Error fetching user stats:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
