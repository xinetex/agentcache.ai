/**
 * Customer Usage Tracking Middleware
 * 
 * Tracks API usage per customer for billing, analytics, and monitoring.
 * Integrates with PostgreSQL for persistent storage and Redis for real-time counters.
 */

import { Context, Next } from 'hono';
import { Redis } from '@upstash/redis';

// Initialize Redis client
let redis: Redis | null = null;
try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
} catch (error) {
  console.error('[Usage Tracking] Redis initialization failed:', error);
}

// Customer identifiers
export const CUSTOMERS = {
  AUDIO1_TV: 'audio1_tv',
  JETTYTHUNDER: 'jettythunder_app',
  UNKNOWN: 'unknown'
} as const;

// Service categories for billing
export const SERVICE_CATEGORIES = {
  CDN_STREAMING: 'cdn_streaming',
  TRANSCODING: 'transcoding',
  FILE_PROVISIONING: 'file_provisioning',
  EDGE_ROUTING: 'edge_routing',
  CHUNK_CACHING: 'chunk_caching',
  USER_STATS: 'user_stats',
  AI_PROCESSING: 'ai_processing',
  CORE_CACHING: 'core_caching',
} as const;

// Endpoint to customer mapping
const ENDPOINT_CUSTOMER_MAP: Record<string, string> = {
  '/api/cdn/stream': CUSTOMERS.AUDIO1_TV,
  '/api/cdn/warm': CUSTOMERS.AUDIO1_TV,
  '/api/cdn/status': CUSTOMERS.AUDIO1_TV,
  '/api/transcode/submit': CUSTOMERS.AUDIO1_TV,
  '/api/transcode/status': CUSTOMERS.AUDIO1_TV,
  '/api/transcode/jobs': CUSTOMERS.AUDIO1_TV,
  '/api/brain': CUSTOMERS.AUDIO1_TV, // Optional
  
  '/api/provision/jettythunder': CUSTOMERS.JETTYTHUNDER,
  '/api/jetty/optimal-edges': CUSTOMERS.JETTYTHUNDER,
  '/api/jetty/track-upload': CUSTOMERS.JETTYTHUNDER,
  '/api/jetty/cache-chunk': CUSTOMERS.JETTYTHUNDER,
  '/api/jetty/user-stats': CUSTOMERS.JETTYTHUNDER,
  '/api/jetty/check-duplicate': CUSTOMERS.JETTYTHUNDER,
  '/api/muscle/plan': CUSTOMERS.JETTYTHUNDER,
  '/api/muscle/reflex': CUSTOMERS.JETTYTHUNDER,
  '/api/s3/presigned': CUSTOMERS.JETTYTHUNDER,
};

// Endpoint to service category mapping
const ENDPOINT_SERVICE_MAP: Record<string, string> = {
  '/api/cdn/stream': SERVICE_CATEGORIES.CDN_STREAMING,
  '/api/cdn/warm': SERVICE_CATEGORIES.CDN_STREAMING,
  '/api/transcode/submit': SERVICE_CATEGORIES.TRANSCODING,
  '/api/transcode/status': SERVICE_CATEGORIES.TRANSCODING,
  '/api/transcode/jobs': SERVICE_CATEGORIES.TRANSCODING,
  
  '/api/provision/jettythunder': SERVICE_CATEGORIES.FILE_PROVISIONING,
  '/api/jetty/optimal-edges': SERVICE_CATEGORIES.EDGE_ROUTING,
  '/api/jetty/track-upload': SERVICE_CATEGORIES.CHUNK_CACHING,
  '/api/jetty/cache-chunk': SERVICE_CATEGORIES.CHUNK_CACHING,
  '/api/jetty/user-stats': SERVICE_CATEGORIES.USER_STATS,
  '/api/brain': SERVICE_CATEGORIES.AI_PROCESSING,
  '/api/cache': SERVICE_CATEGORIES.CORE_CACHING,
};

interface UsageMetrics {
  customerId: string;
  service: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  requestSize?: number;
  responseSize?: number;
  errorMessage?: string;
}

/**
 * Identify customer from request path
 */
function identifyCustomer(path: string): string {
  for (const [endpoint, customer] of Object.entries(ENDPOINT_CUSTOMER_MAP)) {
    if (path.startsWith(endpoint)) {
      return customer;
    }
  }
  return CUSTOMERS.UNKNOWN;
}

/**
 * Identify service category from request path
 */
function identifyService(path: string): string {
  for (const [endpoint, service] of Object.entries(ENDPOINT_SERVICE_MAP)) {
    if (path.startsWith(endpoint)) {
      return service;
    }
  }
  return 'other';
}

/**
 * Track usage metrics to Redis
 */
async function trackUsageToRedis(metrics: UsageMetrics): Promise<void> {
  if (!redis) return;

  const { customerId, service, statusCode, responseTime, timestamp } = metrics;
  const date = new Date(timestamp);
  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const yearMonthDay = `${yearMonth}-${String(date.getDate()).padStart(2, '0')}`;

  try {
    // Multi-command pipeline for performance
    const pipeline = redis.pipeline();

    // 1. Increment monthly request counter
    const monthlyKey = `usage:${customerId}:${yearMonth}:requests`;
    pipeline.incr(monthlyKey);
    pipeline.expire(monthlyKey, 60 * 60 * 24 * 90); // 90 days retention

    // 2. Increment daily request counter
    const dailyKey = `usage:${customerId}:${yearMonthDay}:requests`;
    pipeline.incr(dailyKey);
    pipeline.expire(dailyKey, 60 * 60 * 24 * 30); // 30 days retention

    // 3. Increment service-specific counter
    const serviceKey = `usage:${customerId}:${service}:${yearMonthDay}`;
    pipeline.incr(serviceKey);
    pipeline.expire(serviceKey, 60 * 60 * 24 * 30);

    // 4. Track error rate
    if (statusCode >= 400) {
      const errorKey = `usage:${customerId}:${yearMonthDay}:errors`;
      pipeline.incr(errorKey);
      pipeline.expire(errorKey, 60 * 60 * 24 * 30);
    }

    // 5. Track response time (store in sorted set for percentile calculations)
    const latencyKey = `usage:${customerId}:${yearMonthDay}:latency`;
    pipeline.zadd(latencyKey, { score: responseTime, member: `${timestamp}` });
    pipeline.expire(latencyKey, 60 * 60 * 24 * 7); // 7 days for latency data

    // 6. Store recent request for debugging (limited to last 100)
    const recentKey = `usage:${customerId}:recent`;
    pipeline.lpush(recentKey, JSON.stringify({
      endpoint: metrics.endpoint,
      method: metrics.method,
      status: statusCode,
      responseTime,
      timestamp,
      error: metrics.errorMessage
    }));
    pipeline.ltrim(recentKey, 0, 99); // Keep last 100
    pipeline.expire(recentKey, 60 * 60 * 24); // 24 hours

    await pipeline.exec();
  } catch (error) {
    console.error('[Usage Tracking] Redis tracking failed:', error);
  }
}

/**
 * Get usage statistics for a customer
 */
export async function getCustomerUsage(customerId: string, period: '24h' | '7d' | '30d' = '24h'): Promise<any> {
  if (!redis) return null;

  const now = new Date();
  let startDate: Date;

  switch (period) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  try {
    // Get daily stats
    const dailyRequests: number[] = [];
    const dailyErrors: number[] = [];
    
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const requestKey = `usage:${customerId}:${dateStr}:requests`;
      const errorKey = `usage:${customerId}:${dateStr}:errors`;

      const [requests, errors] = await Promise.all([
        redis.get(requestKey),
        redis.get(errorKey)
      ]);

      dailyRequests.push(Number(requests) || 0);
      dailyErrors.push(Number(errors) || 0);
    }

    const totalRequests = dailyRequests.reduce((a, b) => a + b, 0);
    const totalErrors = dailyErrors.reduce((a, b) => a + b, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      customerId,
      period,
      totalRequests,
      totalErrors,
      errorRate: Math.round(errorRate * 100) / 100,
      dailyBreakdown: dailyRequests,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Usage Tracking] Failed to get customer usage:', error);
    return null;
  }
}

/**
 * Usage tracking middleware
 */
export async function customerUsageTracking(c: Context, next: Next) {
  const startTime = Date.now();
  const path = c.req.path;
  const method = c.req.method;

  // Identify customer and service
  const customerId = identifyCustomer(path);
  const service = identifyService(path);

  // Skip tracking for unknown customers and non-customer endpoints
  if (customerId === CUSTOMERS.UNKNOWN) {
    await next();
    return;
  }

  try {
    // Process request
    await next();

    // Calculate metrics
    const responseTime = Date.now() - startTime;
    const statusCode = c.res.status;

    // Track to Redis (fire and forget)
    const metrics: UsageMetrics = {
      customerId,
      service,
      endpoint: path,
      method,
      statusCode,
      responseTime,
      timestamp: startTime,
    };

    trackUsageToRedis(metrics).catch(err => {
      console.error('[Usage Tracking] Failed to track:', err);
    });

    // Add custom header for debugging
    c.header('X-Customer-Id', customerId);
    c.header('X-Service-Category', service);
    c.header('X-Response-Time', `${responseTime}ms`);

  } catch (error: any) {
    // Track error
    const responseTime = Date.now() - startTime;
    const metrics: UsageMetrics = {
      customerId,
      service,
      endpoint: path,
      method,
      statusCode: 500,
      responseTime,
      timestamp: startTime,
      errorMessage: error.message
    };

    trackUsageToRedis(metrics).catch(() => {});
    
    throw error;
  }
}

/**
 * Get real-time usage for monitoring dashboard
 */
export async function getRealtimeUsage(): Promise<any> {
  if (!redis) return null;

  try {
    const [audio1Usage, jettyUsage] = await Promise.all([
      getCustomerUsage(CUSTOMERS.AUDIO1_TV, '24h'),
      getCustomerUsage(CUSTOMERS.JETTYTHUNDER, '24h')
    ]);

    return {
      customers: [
        {
          id: CUSTOMERS.AUDIO1_TV,
          name: 'audio1.tv',
          ...audio1Usage
        },
        {
          id: CUSTOMERS.JETTYTHUNDER,
          name: 'jettythunder.app',
          ...jettyUsage
        }
      ],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Usage Tracking] Failed to get realtime usage:', error);
    return null;
  }
}
