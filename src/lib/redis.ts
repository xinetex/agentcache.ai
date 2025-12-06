import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

class MockRedis {
  private data = new Map<string, any>();

  constructor() {
    console.log('⚠️ Using In-Memory Mock Redis');
  }

  on(event: string, cb: any) { return this; }

  async rpush(key: string, val: string) {
    if (!this.data.has(key)) this.data.set(key, []);
    this.data.get(key).push(val);
  }
  async ltrim(key: string, start: number, end: number) { }
  async expire(key: string, ttl: number) { }
  async lrange(key: string, start: number, end: number) {
    return this.data.get(key) || [];
  }

  // Sorted Sets (for PredictiveSynapse)
  async zadd(key: string, ...args: (string | number)[]) {
    // Mock: store as simple array, ignore score for now or implement proper zset if needed
    if (!this.data.has(key)) this.data.set(key, new Map());
    const zset = this.data.get(key);
    // args is [score, member, score, member...]
    for (let i = 0; i < args.length; i += 2) {
      zset.set(args[i + 1], Number(args[i]));
    }
  }
  async zincrby(key: string, increment: number, member: string) {
    if (!this.data.has(key)) this.data.set(key, new Map());
    const zset = this.data.get(key);
    const old = zset.get(member) || 0;
    zset.set(member, old + increment);
    return old + increment;
  }
  async zrange(key: string, start: number, stop: number) {
    // Return keys sorted by score asc (default)
    if (!this.data.has(key)) return [];
    const zset = this.data.get(key);
    const entries = Array.from(zset.entries()).sort((a: any, b: any) => a[1] - b[1]); // ASC sort
    const sliced = entries.slice(start, stop === -1 ? undefined : stop + 1);
    return sliced.map(x => x[0]);
  }

  async zrevrange(key: string, start: number, stop: number, withScores?: string) {
    // Return keys sorted by score desc
    if (!this.data.has(key)) return [];
    const zset = this.data.get(key);
    // Sort entries
    const entries = Array.from(zset.entries()).sort((a: any, b: any) => b[1] - a[1]);
    const sliced = entries.slice(start, stop === -1 ? undefined : stop + 1);

    if (withScores) {
      return sliced.flatMap(x => x);
    }
    return sliced.map(x => x[0]);
  }

  async get(key: string) { return this.data.get(key); }
  async set(key: string, val: string) { this.data.set(key, val); }
}

let client: any;

if (REDIS_URL === 'mock' || REDIS_URL === 'redis://mock:6379' || (REDIS_URL && REDIS_URL.includes('@mock:')) || process.env.NODE_ENV === 'test') {
  client = new MockRedis();
} else if (!REDIS_URL) {
  // If no URL and not test/mock, we warn but fallback to mock to prevent crash in dev
  console.warn('⚠️ REDIS_URL not configured. Using In-Memory Mock Redis.');
  client = new MockRedis();
} else {
  try {
    client = new (Redis as any)(REDIS_URL, {
      maxRetriesPerRequest: 1, // Fail fast if config is bad
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying
        return Math.min(times * 50, 2000);
      }
    });
    client.on('connect', () => console.log('✅ Redis connected'));
    // Suppress hard crash on error
    client.on('error', (err: Error) => console.warn('Redis Connection Warning:', err.message));
  } catch (e) {
    console.warn('Failed to init Redis, falling back to mock', e);
    client = new MockRedis();
  }
}

// Redis client
export const redis = client;

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
