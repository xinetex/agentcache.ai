import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

if (!REDIS_URL) {
  console.error('❌ REDIS_URL not configured');
  process.exit(1);
}

// Redis client
export const redis = new (Redis as any)(REDIS_URL);

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err: Error) => console.error('❌ Redis error:', err));

/**
 * Append a message to a session's conversation history (L2 Cache)
 */
export async function appendToSession(sessionId: string, message: any) {
  const key = `session:${sessionId}`;
  // Push to right of list
  await redis.rpush(key, JSON.stringify(message));
  // Trim to keep only last 50 messages (Warm Tier Limit)
  await redis.ltrim(key, -50, -1);
  // Set TTL for the session (e.g., 24 hours)
  await redis.expire(key, 86400);
}

/**
 * Get recent conversation history from L2 Cache
 */
export async function getSessionHistory(sessionId: string): Promise<any[]> {
  const key = `session:${sessionId}`;
  const raw = await redis.lrange(key, 0, -1);
  return raw.map((item: string) => JSON.parse(item));
}
