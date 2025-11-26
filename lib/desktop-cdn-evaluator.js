import crypto from 'crypto';

/**
 * Desktop CDN Cache Evaluator
 * 
 * Analyzes JettyThunder Desktop CDN (localhost:53777) traffic patterns
 * to make intelligent caching decisions for:
 * - Video streaming with range requests
 * - JettySpeed multi-path chunks
 * - Local file access patterns
 * - iPhone photo backup flows
 * 
 * Innovation: Learns from desktop → cloud access patterns to optimize
 * which content stays local vs cached at edge vs Lyve-only
 */

/**
 * File access pattern types
 */
const AccessPatterns = {
  STREAMING: 'streaming',        // Video/audio streaming with range requests
  CHUNK_UPLOAD: 'chunk_upload',  // JettySpeed multi-path uploads
  SEQUENTIAL: 'sequential',      // Full file reads (downloads)
  RANDOM: 'random',             // Random access (thumbnails, previews)
  BACKUP: 'backup',             // iPhone photo sync, snapshots
};

/**
 * Cache tier recommendations
 */
const CacheTiers = {
  LOCAL_ONLY: 'local_only',          // Desktop CDN cache only (hot data)
  LOCAL_EDGE: 'local_edge',          // Desktop + AgentCache edge
  EDGE_LYVE: 'edge_lyve',           // AgentCache edge + Lyve fallback
  LYVE_ONLY: 'lyve_only',           // Direct to Lyve (cold data)
};

/**
 * Analyze file access pattern from request history
 * @param {Array} requestHistory - Array of { timestamp, byteRange, size }
 * @returns {Object} Pattern analysis
 */
export function analyzeAccessPattern(requestHistory) {
  if (requestHistory.length === 0) {
    return { pattern: AccessPatterns.SEQUENTIAL, confidence: 0 };
  }

  const totalRequests = requestHistory.length;
  const hasRangeRequests = requestHistory.some(r => r.byteRange);
  const totalBytesRequested = requestHistory.reduce((sum, r) => sum + (r.size || 0), 0);
  
  // Calculate time span
  const timestamps = requestHistory.map(r => r.timestamp).sort();
  const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
  const avgRequestInterval = timeSpan / Math.max(totalRequests - 1, 1);

  // Detect streaming pattern (many range requests, regular intervals)
  if (hasRangeRequests && totalRequests > 5 && avgRequestInterval < 1000) {
    return {
      pattern: AccessPatterns.STREAMING,
      confidence: 0.9,
      metrics: {
        avgRequestInterval,
        totalRequests,
        estimatedStreamingDuration: timeSpan / 1000, // seconds
      },
    };
  }

  // Detect chunk upload pattern (sequential chunks, high frequency)
  if (totalRequests > 10 && avgRequestInterval < 500) {
    const isSequential = requestHistory.every((req, i) => {
      if (i === 0) return true;
      return req.chunkIndex === requestHistory[i - 1].chunkIndex + 1;
    });

    if (isSequential) {
      return {
        pattern: AccessPatterns.CHUNK_UPLOAD,
        confidence: 0.95,
        metrics: {
          totalChunks: totalRequests,
          avgChunkSize: totalBytesRequested / totalRequests,
        },
      };
    }
  }

  // Detect backup pattern (many small files, consistent time)
  if (totalRequests > 20 && avgRequestInterval < 2000) {
    const avgSize = totalBytesRequested / totalRequests;
    if (avgSize < 10 * 1024 * 1024) { // < 10MB avg
      return {
        pattern: AccessPatterns.BACKUP,
        confidence: 0.85,
        metrics: {
          totalFiles: totalRequests,
          avgFileSize: avgSize,
        },
      };
    }
  }

  // Default: sequential access
  return {
    pattern: AccessPatterns.SEQUENTIAL,
    confidence: 0.6,
    metrics: { totalRequests },
  };
}

/**
 * Recommend cache tier based on access pattern and file characteristics
 * @param {Object} file - File metadata
 * @param {Object} accessPattern - Result from analyzeAccessPattern
 * @param {Object} stats - Historical stats
 * @returns {Object} Cache tier recommendation
 */
export function recommendCacheTier(file, accessPattern, stats = {}) {
  const { pattern, metrics } = accessPattern;
  const fileSize = file.size || 0;
  const accessCount = stats.accessCount || 0;
  const lastAccessed = stats.lastAccessed || Date.now();
  const age = Date.now() - lastAccessed;

  // Streaming content: Keep locally + edge cache
  if (pattern === AccessPatterns.STREAMING) {
    // Videos accessed in last 7 days → local + edge
    if (age < 7 * 24 * 60 * 60 * 1000) {
      return {
        tier: CacheTiers.LOCAL_EDGE,
        reason: 'Streaming content recently accessed',
        localTTL: 86400, // 24 hours local
        edgeTTL: 3600,   // 1 hour edge
        priority: 'high',
      };
    }
    
    // Older videos → edge only
    return {
      tier: CacheTiers.EDGE_LYVE,
      reason: 'Streaming content, not recent',
      edgeTTL: 7200, // 2 hours
      priority: 'medium',
    };
  }

  // Chunk uploads: Edge cache only (temporary)
  if (pattern === AccessPatterns.CHUNK_UPLOAD) {
    return {
      tier: CacheTiers.EDGE_LYVE,
      reason: 'JettySpeed chunk upload',
      edgeTTL: 3600, // 1 hour (reassembly time)
      priority: 'high',
    };
  }

  // Backup content: Tiered based on access frequency
  if (pattern === AccessPatterns.BACKUP) {
    if (accessCount > 3) {
      // Frequently accessed backups (e.g., recent iPhone photos) → local
      return {
        tier: CacheTiers.LOCAL_EDGE,
        reason: 'Frequently accessed backup',
        localTTL: 604800, // 7 days
        edgeTTL: 86400,   // 1 day
        priority: 'medium',
      };
    }
    
    // One-time backups → Lyve only
    return {
      tier: CacheTiers.LYVE_ONLY,
      reason: 'One-time backup, archive',
      priority: 'low',
    };
  }

  // Hot files (accessed >5 times in last day) → local
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  if (accessCount > 5 && lastAccessed > oneDayAgo) {
    return {
      tier: CacheTiers.LOCAL_ONLY,
      reason: 'Hot file, frequent recent access',
      localTTL: 86400,
      priority: 'high',
    };
  }

  // Large files (>1GB), low access → Lyve only
  if (fileSize > 1024 * 1024 * 1024 && accessCount < 2) {
    return {
      tier: CacheTiers.LYVE_ONLY,
      reason: 'Large file, infrequent access',
      priority: 'low',
    };
  }

  // Default: Edge + Lyve
  return {
    tier: CacheTiers.EDGE_LYVE,
    reason: 'Standard caching strategy',
    edgeTTL: 3600,
    priority: 'medium',
  };
}

/**
 * Calculate optimal local cache size based on available disk space
 * @param {number} availableDiskSpace - Bytes available
 * @param {Object} usage - Current cache usage
 * @returns {Object} Cache size recommendation
 */
export function calculateOptimalLocalCacheSize(availableDiskSpace, usage = {}) {
  const currentCacheSize = usage.currentSize || 0;
  const hitRate = usage.hitRate || 0;
  const avgFileSize = usage.avgFileSize || 10 * 1024 * 1024; // 10MB default

  // Use 10-20% of available disk space for cache
  const minCacheSize = Math.min(5 * 1024 * 1024 * 1024, availableDiskSpace * 0.1); // 5GB min or 10%
  const maxCacheSize = Math.min(50 * 1024 * 1024 * 1024, availableDiskSpace * 0.2); // 50GB max or 20%

  // Adjust based on hit rate
  let recommendedSize = minCacheSize;
  if (hitRate > 0.8) {
    // High hit rate → increase cache size
    recommendedSize = maxCacheSize;
  } else if (hitRate > 0.6) {
    // Medium hit rate → balanced size
    recommendedSize = (minCacheSize + maxCacheSize) / 2;
  }

  // Ensure we can fit at least 100 files
  const minSizeForFiles = avgFileSize * 100;
  recommendedSize = Math.max(recommendedSize, minSizeForFiles);

  return {
    recommended: recommendedSize,
    min: minCacheSize,
    max: maxCacheSize,
    filesCapacity: Math.floor(recommendedSize / avgFileSize),
    reasoning: `Hit rate: ${(hitRate * 100).toFixed(1)}%, Disk available: ${(availableDiskSpace / 1024 / 1024 / 1024).toFixed(2)}GB`,
  };
}

/**
 * Predict bandwidth savings from desktop CDN caching
 * @param {Array} accessLog - Historical access log
 * @param {Object} cacheConfig - Current cache configuration
 * @returns {Object} Savings prediction
 */
export function predictBandwidthSavings(accessLog, cacheConfig) {
  if (accessLog.length === 0) {
    return { savedBytes: 0, savedCost: 0, hitRate: 0 };
  }

  // Group accesses by file
  const fileAccesses = {};
  accessLog.forEach(access => {
    if (!fileAccesses[access.fileId]) {
      fileAccesses[access.fileId] = [];
    }
    fileAccesses[access.fileId].push(access);
  });

  let totalBytes = 0;
  let cachedBytes = 0;

  Object.entries(fileAccesses).forEach(([fileId, accesses]) => {
    const fileSize = accesses[0].size || 0;
    const accessCount = accesses.length;
    
    totalBytes += fileSize * accessCount;

    // If file would be cached (>1 access), count savings
    if (accessCount > 1) {
      // First access: cache miss (no savings)
      // Subsequent accesses: cache hit (full savings)
      cachedBytes += fileSize * (accessCount - 1);
    }
  });

  const hitRate = totalBytes > 0 ? cachedBytes / totalBytes : 0;
  
  // Calculate cost savings (Lyve egress: $0.09/GB)
  const savedGB = cachedBytes / (1024 * 1024 * 1024);
  const savedCost = savedGB * 0.09;

  return {
    totalBytes,
    savedBytes: cachedBytes,
    savedGB: savedGB.toFixed(2),
    savedCost: savedCost.toFixed(2),
    hitRate: (hitRate * 100).toFixed(2),
    estimatedMonthlySavings: (savedCost * 30).toFixed(2), // Extrapolate
  };
}

/**
 * Generate cache eviction priority for LRU cache
 * @param {Object} file - File metadata
 * @param {Object} stats - Access statistics
 * @returns {number} Priority score (higher = keep longer)
 */
export function calculateEvictionPriority(file, stats) {
  let score = 0;

  // Factor 1: Recency (0-40 points)
  const age = Date.now() - stats.lastAccessed;
  const ageHours = age / (1000 * 60 * 60);
  if (ageHours < 1) score += 40;
  else if (ageHours < 6) score += 30;
  else if (ageHours < 24) score += 20;
  else if (ageHours < 168) score += 10; // < 1 week

  // Factor 2: Frequency (0-30 points)
  const accessCount = stats.accessCount || 0;
  if (accessCount > 10) score += 30;
  else if (accessCount > 5) score += 20;
  else if (accessCount > 2) score += 10;

  // Factor 3: File type priority (0-20 points)
  if (file.contentType?.startsWith('video/')) score += 20; // Videos high priority
  else if (file.contentType?.startsWith('image/')) score += 15;
  else if (file.contentType?.startsWith('audio/')) score += 10;

  // Factor 4: Size penalty (0-10 points, smaller = better)
  const sizeMB = (file.size || 0) / (1024 * 1024);
  if (sizeMB < 10) score += 10;
  else if (sizeMB < 100) score += 7;
  else if (sizeMB < 500) score += 5;

  return score; // Max score: 100
}

/**
 * Analyze desktop CDN performance for a namespace
 * @param {Array} metrics - Performance metrics
 * @returns {Object} Performance analysis
 */
export function analyzeDesktopCDNPerformance(metrics) {
  if (metrics.length === 0) {
    return { healthy: true, issues: [] };
  }

  const issues = [];
  const warnings = [];

  // Calculate averages
  const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;
  const cacheHits = metrics.filter(m => m.cacheHit).length;
  const hitRate = cacheHits / metrics.length;
  const avgSize = metrics.reduce((sum, m) => sum + (m.size || 0), 0) / metrics.length;

  // Issue detection
  if (avgLatency > 100) {
    issues.push({
      type: 'high_latency',
      message: `Average latency ${avgLatency.toFixed(0)}ms exceeds 100ms threshold`,
      severity: 'high',
      recommendation: 'Increase local cache size or check disk I/O',
    });
  }

  if (hitRate < 0.5) {
    warnings.push({
      type: 'low_hit_rate',
      message: `Cache hit rate ${(hitRate * 100).toFixed(1)}% below 50%`,
      severity: 'medium',
      recommendation: 'Increase cache TTL or cache size',
    });
  }

  if (avgSize > 100 * 1024 * 1024) {
    warnings.push({
      type: 'large_files',
      message: `Average file size ${(avgSize / 1024 / 1024).toFixed(1)}MB may strain cache`,
      severity: 'low',
      recommendation: 'Consider chunk-based caching for large files',
    });
  }

  return {
    healthy: issues.length === 0,
    avgLatency: avgLatency.toFixed(2),
    hitRate: (hitRate * 100).toFixed(2),
    avgSize: (avgSize / 1024 / 1024).toFixed(2),
    issues,
    warnings,
    score: Math.max(0, 100 - issues.length * 30 - warnings.length * 10),
  };
}

export default {
  analyzeAccessPattern,
  recommendCacheTier,
  calculateOptimalLocalCacheSize,
  predictBandwidthSavings,
  calculateEvictionPriority,
  analyzeDesktopCDNPerformance,
  AccessPatterns,
  CacheTiers,
};
