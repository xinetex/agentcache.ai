import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

// --- CONFIGURATION ---
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_URL = process.env.REDIS_URL;

// --- MOCK REDIS (In-Memory Fallback) ---
class MockRedis {
  private data = new Map<string, any>();
  private listeners = new Map<string, Function[]>();

  constructor() {
    console.log('⚠️ Using In-Memory Mock Redis (Isomorphic)');
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
    return this;
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(...args));
    }
    return true;
  }

  // ioredis connects automatically, so we simulate that
  connect() {
    this.emit('connect');
  }

  duplicate() {
    const other = new MockRedis();
    other['data'] = this.data; // Share data
    return other;
  }

  // Basic KV
  async get(key: string) { return this.data.get(key) || null; }
  async set(key: string, val: string) { this.data.set(key, val); return 'OK'; }
  async del(key: string) { return this.data.delete(key) ? 1 : 0; }
  async exists(key: string) { return this.data.has(key) ? 1 : 0; }
  async ttl(key: string) { return this.data.has(key) ? -1 : -2; }

  // Compatibility shim for setex (key, seconds, value)
  async setex(key: string, seconds: number, val: string) {
    this.data.set(key, val);
    // In a real mock we'd set a timeout, but for simple logic check it's fine
    return 'OK';
  }

  // Lists
  async rpush(key: string, ...vals: string[]) {
    if (!this.data.has(key)) this.data.set(key, []);
    const list = this.data.get(key);
    list.push(...vals);
    return list.length;
  }
  async ltrim(key: string, start: number, end: number) {
    if (!this.data.has(key)) return 'OK';
    const list = this.data.get(key);
    if (end === -1) end = list.length - 1;
    this.data.set(key, list.slice(start, end + 1));
    return 'OK';
  }
  async expire(key: string, ttl: number) { return 1; }
  async lrange(key: string, start: number, end: number) {
    const list = this.data.get(key) || [];
    if (end === -1) end = list.length - 1;
    return list.slice(start, end + 1);
  }

  // Hashes
  async hget(key: string, field: string) {
    if (!this.data.has(key)) return null;
    const hash = this.data.get(key);
    if (!(hash instanceof Map)) return null;
    return hash.get(String(field));
  }
  async hset(key: string, field: any, value?: any) {
    if (!this.data.has(key)) this.data.set(key, new Map());
    const hash = this.data.get(key);
    // Handle object vs arguments
    if (typeof field === 'object') {
      for (const [k, v] of Object.entries(field)) {
        hash.set(String(k), v);
      }
    } else {
      hash.set(String(field), value);
    }
    return 1;
  }
  async hdel(key: string, field: string) {
    if (!this.data.has(key)) return 0;
    const hash = this.data.get(key);
    if (hash instanceof Map) {
      hash.delete(String(field));
    }
    return 1;
  }

  // PubSub (Minimal)
  async publish(channel: string, message: string) { return 0; }
  async subscribe(channel: string) { return 0; }
}

// --- UPSTASH WRAPPER ---
// Wraps Upstash HTTP client to match IORedis signature where needed
class UpstashWrapper {
  private client: UpstashRedis;

  constructor(url: string, token: string) {
    console.log('⚡ Using Upstash Redis (HTTP)');
    this.client = new UpstashRedis({ url, token });
  }

  // Passthrough for most methods
  async get(key: string) { return this.client.get(key); }
  async set(key: string, val: any) { return this.client.set(key, val); }
  async del(key: string) { return this.client.del(key); }
  async exists(key: string) { return this.client.exists(key); }
  async ttl(key: string) { return this.client.ttl(key); }

  // Lists
  async rpush(key: string, ...vals: any[]) { return this.client.rpush(key, ...vals); }
  async ltrim(key: string, start: number, end: number) { return this.client.ltrim(key, start, end); }
  async expire(key: string, ttl: number) { return this.client.expire(key, ttl); }
  async lrange(key: string, start: number, end: number) { return this.client.lrange(key, start, end); }

  // Hashes
  async hget(key: string, field: string) { return this.client.hget(key, field); }
  async hset(key: string, field: any, value?: any) {
    // Upstash hset supports { field: value } object
    if (typeof field === 'object') {
      return this.client.hset(key, field);
    }
    return this.client.hset(key, { [field]: value });
  }
  async hdel(key: string, field: string) { return this.client.hdel(key, field); }

  // Compatibility Shims
  async setex(key: string, seconds: number, val: any) {
    return this.client.set(key, val, { ex: seconds });
  }

  // IORedis-specific
  on(event: string, cb: Function) {
    // Upstash HTTP doesn't have events, but we stub it to prevent crashes
    if (event === 'connect') cb();
    return this;
  }
  duplicate() { return this; } // HTTP is stateless
}

// --- FACTORY ---
let client: any;

const isTest = process.env.NODE_ENV === 'test';
const isMockConfig = REDIS_URL === 'mock' || REDIS_URL?.includes('@mock:');

if (isTest || isMockConfig) {
  client = new MockRedis();
}
else if (UPSTASH_URL && UPSTASH_TOKEN) {
  // PV1: Upstash HTTP (Serverless Friendly)
  client = new UpstashWrapper(UPSTASH_URL, UPSTASH_TOKEN);
}
else if (REDIS_URL) {
  // PV2: IORedis (TCP)
  try {
    console.log('🔌 Using IORedis (TCP)');
    client = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => times > 3 ? null : Math.min(times * 50, 2000)
    });
    if (!process.env.VERCEL) {
      client.on('error', (err: any) => console.warn('Redis Connection Warning:', err.message));
    }
  } catch (e) {
    console.warn('Failed to init IORedis, falling back to mock');
    client = new MockRedis();
  }
}
else {
  console.warn('⚠️ No Redis credentials found. Using In-Memory Mock.');
  client = new MockRedis();
}

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
