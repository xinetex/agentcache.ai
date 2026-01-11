import Redis from 'ioredis';
import { EventEmitter } from 'events';

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

class MockRedis extends EventEmitter {
  private data = new Map<string, any>();

  constructor() {
    super();
    console.log('⚠️ Using In-Memory Mock Redis');
  }

  // EventEmitter 'on' is inherited, but we can override if needed, or just let it be.
  // ioredis connects automatically, so we simulate that
  connect() {
    this.emit('connect');
  }

  duplicate() {
    // Return a new instance, sharing the same data map for "remote" simulation
    // In a real mock, we'd want them to share the 'data' store but be separate objects
    // for events.
    const other = new MockRedis();
    other.data = this.data; // Share data
    // For Pub/Sub to work between instances in memory, we need a shared event bus
    // or they need to share the same EventEmitter mechanism.
    // However, simplest way for single-process mock:
    // When one publishes, we emit on ALL instances?
    // Or we use a global event bus for the mock.
    return other;
  }

  // Shared bus for Pub/Sub across instances
  static _bus = new EventEmitter();

  async publish(channel: string, message: string) {
    // console.log(`[MockRedis] Publish to ${channel}: ${message}`);
    // Emit to global bus
    MockRedis._bus.emit(channel, message);
    return 1; // 1 subscriber received it (fake)
  }

  async subscribe(channel: string, cb?: any) {
    // console.log(`[MockRedis] Subscribing to ${channel}`);
    // Listen on global bus
    MockRedis._bus.on(channel, (message) => {
      // console.log(`[MockRedis] Received on ${channel}: ${message}`);
      this.emit('message', channel, message);
    });
    if (cb) cb();
    return 1;
  }


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
  async hget(key: string, field: string) {
    if (!this.data.has(key)) return null;
    const hash = this.data.get(key);
    if (!(hash instanceof Map)) return null;
    return hash.get(String(field));
  }
  async hset(key: string, field: string, value: any) {
    if (!this.data.has(key)) this.data.set(key, new Map());
    const hash = this.data.get(key);
    if (hash instanceof Map) {
      hash.set(String(field), value);
    }
  }
  async hdel(key: string, field: string) {
    if (!this.data.has(key)) return 0;
    const hash = this.data.get(key);
    if (hash instanceof Map) {
      hash.delete(String(field));
    }
    return 1;
  }
  async zadd(key: string, ...args: (string | number)[]) {
    // Mock: store as simple array, ignore score for now or implement proper zset if needed
    if (!this.data.has(key)) this.data.set(key, new Map());
    const zset = this.data.get(key);
    // args is [score, member, score, member...]
    for (let i = 0; i < args.length; i += 2) {
      zset.set(String(args[i + 1]), Number(args[i]));
    }
  }
  async zincrby(key: string, increment: number, member: string) {
    if (!this.data.has(key)) this.data.set(key, new Map());
    const zset = this.data.get(key);
    const m = String(member);
    const old = zset.get(m) || 0;
    zset.set(m, old + increment);
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
  async del(key: string) { this.data.delete(key); }


  async incr(key: string) {
    const val = this.data.get(key) || 0;
    const newVal = Number(val) + 1;
    this.data.set(key, newVal);
    return newVal;
  }
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
