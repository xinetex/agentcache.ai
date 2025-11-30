import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export const config = {
  runtime: 'nodejs'
};

/**
 * POST /api/lab/run-experiment
 * 
 * Executes a cache strategy test with synthetic workload
 * Returns real-time metrics and stores results in database
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const {
      strategyId,
      workloadId,
      sessionId, // Optional: link to game session
      iterations = 1000, // How many queries to test
    } = req.body;

    if (!strategyId || !workloadId) {
      return res.status(400).json({ 
        error: 'strategyId and workloadId are required' 
      });
    }

    const sql = neon(process.env.DATABASE_URL);
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      return res.status(500).json({ error: 'Redis not configured' });
    }

    // Fetch strategy and workload configurations
    const [strategy] = await sql`
      SELECT * FROM lab_strategies WHERE id = ${strategyId}
    `;

    const [workload] = await sql`
      SELECT * FROM lab_workloads WHERE id = ${workloadId}
    `;

    if (!strategy || !workload) {
      return res.status(404).json({ error: 'Strategy or workload not found' });
    }

    // Parse configs
    const strategyConfig = typeof strategy.config === 'string' 
      ? JSON.parse(strategy.config) 
      : strategy.config;
    
    const workloadConfig = typeof workload.config === 'string'
      ? JSON.parse(workload.config)
      : workload.config;

    // Create experiment record
    const [experiment] = await sql`
      INSERT INTO lab_experiments (
        strategy_id,
        workload_id,
        session_id,
        strategy_config,
        workload_config,
        status,
        started_at
      ) VALUES (
        ${strategyId},
        ${workloadId},
        ${sessionId || null},
        ${JSON.stringify(strategyConfig)},
        ${JSON.stringify(workloadConfig)},
        'running',
        NOW()
      )
      RETURNING id
    `;

    const experimentId = experiment.id;

    // Run experiment in background (use real isolated namespace)
    const namespace = `lab:exp:${experimentId}`;
    
    try {
      // Simulate cache operations with workload
      const metrics = await runCacheExperiment({
        experimentId,
        namespace,
        strategyConfig,
        workloadConfig,
        iterations,
        redisUrl,
        redisToken,
      });

      // Calculate statistics
      const stats = calculateStatistics(metrics);

      // Update experiment with results
      await sql`
        UPDATE lab_experiments
        SET
          status = 'completed',
          completed_at = NOW(),
          duration_seconds = ${stats.durationSeconds},
          total_requests = ${metrics.length},
          l1_hits = ${stats.l1Hits},
          l2_hits = ${stats.l2Hits},
          l3_hits = ${stats.l3Hits},
          misses = ${stats.misses},
          hit_rate = ${stats.hitRate},
          latency_p50 = ${stats.latencyP50},
          latency_p95 = ${stats.latencyP95},
          latency_p99 = ${stats.latencyP99},
          latency_max = ${stats.latencyMax},
          cost_per_query = ${stats.costPerQuery},
          cost_per_1k_queries = ${stats.costPer1k},
          memory_used_mb = ${stats.memoryUsedMB},
          confidence_interval_95 = ${JSON.stringify(stats.confidenceInterval)},
          sample_size_adequate = ${stats.sampleSizeAdequate},
          raw_metrics = ${JSON.stringify(metrics.slice(0, 100))} -- Store first 100 for analysis
        WHERE id = ${experimentId}
      `;

      // Cleanup Redis namespace
      await cleanupNamespace(redisUrl, redisToken, namespace);

      return res.status(200).json({
        experimentId,
        status: 'completed',
        statistics: stats,
        message: `Experiment completed: ${metrics.length} queries tested`,
      });

    } catch (expError) {
      // Mark experiment as failed
      await sql`
        UPDATE lab_experiments
        SET
          status = 'failed',
          completed_at = NOW(),
          error_count = 1,
          error_details = ${JSON.stringify({ message: expError.message, stack: expError.stack })}
        WHERE id = ${experimentId}
      `;

      throw expError;
    }

  } catch (error) {
    console.error('Experiment runner error:', error);
    return res.status(500).json({
      error: 'Failed to run experiment',
      message: error.message
    });
  }
}

/**
 * Execute cache experiment with workload simulation
 */
async function runCacheExperiment({
  experimentId,
  namespace,
  strategyConfig,
  workloadConfig,
  iterations,
  redisUrl,
  redisToken,
}) {
  const metrics = [];
  const startTime = Date.now();

  // Simulate cache tiers (L1/L2/L3)
  const l1Cache = new Map(); // In-memory simulation
  const l2Cache = new Map();
  const l3Cache = new Map();

  // Parse tier configs
  const l1Config = strategyConfig.tiers?.L1;
  const l2Config = strategyConfig.tiers?.L2;
  const l3Config = strategyConfig.tiers?.L3;

  // Generate workload queries (simplified version)
  const queries = generateQueries(workloadConfig, iterations);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const queryStart = Date.now();
    
    let tier = null;
    let hit = false;

    // Try L1
    if (l1Config?.enabled) {
      if (l1Cache.has(query.key)) {
        const cached = l1Cache.get(query.key);
        const age = Date.now() - cached.timestamp;
        if (age < l1Config.ttl * 1000) {
          tier = 'L1';
          hit = true;
        } else {
          l1Cache.delete(query.key); // Expired
        }
      }
    }

    // Try L2 on L1 miss
    if (!hit && l2Config?.enabled) {
      if (l2Cache.has(query.key)) {
        const cached = l2Cache.get(query.key);
        const age = Date.now() - cached.timestamp;
        if (age < l2Config.ttl * 1000) {
          tier = 'L2';
          hit = true;
          // Promote to L1
          if (l1Config?.enabled) {
            l1Cache.set(query.key, { data: cached.data, timestamp: Date.now() });
          }
        } else {
          l2Cache.delete(query.key);
        }
      }
    }

    // Try L3 on L2 miss (semantic cache)
    if (!hit && l3Config?.enabled && l3Config.semantic) {
      // Simulate semantic similarity check
      const similar = findSimilarInL3(l3Cache, query.key, l3Config.similarityThreshold || 0.85);
      if (similar) {
        tier = 'L3';
        hit = true;
        // Promote to L2 and L1
        if (l2Config?.enabled) {
          l2Cache.set(query.key, { data: similar.data, timestamp: Date.now() });
        }
        if (l1Config?.enabled) {
          l1Cache.set(query.key, { data: similar.data, timestamp: Date.now() });
        }
      }
    }

    // Miss: simulate LLM call and store in all tiers
    if (!hit) {
      tier = 'miss';
      const responseData = `response-${query.key}`;
      
      if (l1Config?.enabled) {
        l1Cache.set(query.key, { data: responseData, timestamp: Date.now() });
      }
      if (l2Config?.enabled) {
        l2Cache.set(query.key, { data: responseData, timestamp: Date.now() });
      }
      if (l3Config?.enabled) {
        l3Cache.set(query.key, { data: responseData, timestamp: Date.now(), vector: query.key });
      }
    }

    const queryEnd = Date.now();
    const latency = queryEnd - queryStart;

    metrics.push({
      queryId: i,
      key: query.key,
      tier,
      hit,
      latency,
      timestamp: queryEnd,
    });

    // Apply cache size limits (LRU eviction)
    enforceMemoryLimits(l1Cache, l1Config?.maxSize);
    enforceMemoryLimits(l2Cache, l2Config?.maxSize);
    enforceMemoryLimits(l3Cache, l3Config?.maxSize);
  }

  return metrics;
}

/**
 * Generate synthetic queries based on workload config
 */
function generateQueries(workloadConfig, count) {
  const queries = [];
  const uniqueKeys = workloadConfig.uniqueQueries || Math.floor(count * 0.2);
  
  // Generate unique keys with Zipfian distribution (80/20 rule)
  const keys = Array.from({ length: uniqueKeys }, (_, i) => `key-${i}`);
  const hotKeys = keys.slice(0, Math.floor(uniqueKeys * 0.2));
  const coldKeys = keys.slice(Math.floor(uniqueKeys * 0.2));

  for (let i = 0; i < count; i++) {
    // 80% of queries target 20% of keys
    const key = Math.random() < 0.8
      ? hotKeys[Math.floor(Math.random() * hotKeys.length)]
      : coldKeys[Math.floor(Math.random() * coldKeys.length)];
    
    queries.push({ key });
  }

  return queries;
}

/**
 * Find similar key in L3 semantic cache
 */
function findSimilarInL3(cache, queryKey, threshold) {
  // Simplified: just check if any key shares prefix (real version would use embeddings)
  for (const [cacheKey, value] of cache.entries()) {
    const similarity = calculateSimilarity(queryKey, cacheKey);
    if (similarity >= threshold) {
      return value;
    }
  }
  return null;
}

/**
 * Simple string similarity (real version would use cosine similarity of embeddings)
 */
function calculateSimilarity(str1, str2) {
  const common = str1.split('').filter(c => str2.includes(c)).length;
  return common / Math.max(str1.length, str2.length);
}

/**
 * Enforce cache size limits with LRU eviction
 */
function enforceMemoryLimits(cache, maxSize) {
  if (!maxSize) return;
  
  // Parse size string to number of entries (simplified)
  const match = maxSize.match(/^(\d+)(KB|MB|GB)$/);
  if (!match) return;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  // Estimate: 1KB per entry
  const maxEntries = unit === 'KB' ? value : unit === 'MB' ? value * 1024 : value * 1024 * 1024;
  
  // LRU: delete oldest entries
  while (cache.size > maxEntries) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

/**
 * Calculate experiment statistics
 */
function calculateStatistics(metrics) {
  const l1Hits = metrics.filter(m => m.tier === 'L1').length;
  const l2Hits = metrics.filter(m => m.tier === 'L2').length;
  const l3Hits = metrics.filter(m => m.tier === 'L3').length;
  const misses = metrics.filter(m => m.tier === 'miss').length;
  
  const totalHits = l1Hits + l2Hits + l3Hits;
  const hitRate = totalHits / metrics.length;
  
  // Latency distribution
  const latencies = metrics.map(m => m.latency).sort((a, b) => a - b);
  const latencyP50 = latencies[Math.floor(latencies.length * 0.5)];
  const latencyP95 = latencies[Math.floor(latencies.length * 0.95)];
  const latencyP99 = latencies[Math.floor(latencies.length * 0.99)];
  const latencyMax = latencies[latencies.length - 1];
  
  // Cost estimation
  const cacheCost = 0.00001; // $0.00001 per cache query
  const llmCost = 0.002; // $0.002 per LLM call
  const costPerQuery = (totalHits * cacheCost + misses * llmCost) / metrics.length;
  const costPer1k = costPerQuery * 1000;
  
  // Memory estimation (simplified)
  const memoryUsedMB = ((l1Hits + l2Hits + l3Hits) * 1) / 1024; // 1KB per cached entry
  
  // Confidence interval for hit rate (95%)
  const hitRateStdDev = Math.sqrt((hitRate * (1 - hitRate)) / metrics.length);
  const marginOfError = 1.96 * hitRateStdDev;
  const confidenceInterval = {
    hitRate: [
      Math.max(0, hitRate - marginOfError),
      Math.min(1, hitRate + marginOfError)
    ],
  };
  
  // Sample size adequacy (need at least 100 queries)
  const sampleSizeAdequate = metrics.length >= 100;
  
  // Duration
  const durationSeconds = Math.floor((metrics[metrics.length - 1].timestamp - metrics[0].timestamp) / 1000);
  
  return {
    l1Hits,
    l2Hits,
    l3Hits,
    misses,
    hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
    latencyP50: Math.round(latencyP50),
    latencyP95: Math.round(latencyP95),
    latencyP99: Math.round(latencyP99),
    latencyMax: Math.round(latencyMax),
    costPerQuery: Math.round(costPerQuery * 100000) / 100000,
    costPer1k: Math.round(costPer1k * 1000) / 1000,
    memoryUsedMB: Math.round(memoryUsedMB * 100) / 100,
    confidenceInterval,
    sampleSizeAdequate,
    durationSeconds,
  };
}

/**
 * Cleanup Redis namespace after experiment
 */
async function cleanupNamespace(redisUrl, redisToken, namespace) {
  try {
    // In production, would scan and delete all keys with namespace prefix
    // For now, just a placeholder
    await fetch(`${redisUrl}/del/${namespace}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${redisToken}` }
    });
  } catch (err) {
    console.error('Cleanup error:', err);
    // Non-fatal
  }
}
