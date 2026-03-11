
import { Redis } from '@upstash/redis';

// Simple In-Memory Mock for offline/dev mode
class MockRedis {
  private store = new Map<string, any>();

  private ensureStoreLimit() {
    if (this.store.size > 5000) {
      // Very naive LRU: delete the first 1000 keys to prevent node OOM
      const keysToDelete = Array.from(this.store.keys()).slice(0, 1000);
      for (const k of keysToDelete) this.store.delete(k);
    }
  }

  private ensureHash(key: string) {
    this.ensureStoreLimit();
    if (
      !this.store.has(key) ||
      typeof this.store.get(key) !== 'object' ||
      Array.isArray(this.store.get(key)) ||
      this.store.get(key) instanceof Map
    ) {
      this.store.set(key, {});
    }
    return this.store.get(key);
  }

  private ensureSortedSet(key: string) {
    if (!this.store.has(key) || !(this.store.get(key) instanceof Map)) {
      this.store.set(key, new Map<string, number>());
    }
    return this.store.get(key) as Map<string, number>;
  }

  private ensureSet(key: string) {
    if (!this.store.has(key) || !(this.store.get(key) instanceof Set)) {
      this.store.set(key, new Set<string>());
    }
    return this.store.get(key) as Set<string>;
  }

  async incrbyfloat(key: string, value: number) {
    if (!this.store.has(key)) this.store.set(key, '0');
    const current = parseFloat(this.store.get(key) || '0');
    const next = current + value;
    this.store.set(key, next.toString());
    return next;
  }

  async get(key: string) {
    return this.store.get(key) || null;
  }

  async set(key: string, value: any) {
    this.store.set(key, value);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: any) {
    this.store.set(key, value);
    return 'OK'; // Ignore expiry for mock
  }

  async decrby(key: string, value: number) {
    const current = parseInt(this.store.get(key) || '0');
    const newValue = current - value;
    this.store.set(key, newValue.toString());
    return newValue;
  }

  async incrby(key: string, value: number) {
    const current = parseInt(this.store.get(key) || '0');
    const newValue = current + value;
    this.store.set(key, newValue.toString());
    return newValue;
  }

  async lpush(key: string, ...values: any[]) {
    if (!this.store.has(key)) this.store.set(key, []);
    const list = this.store.get(key);
    if (Array.isArray(list)) {
      list.unshift(...values);
    }
    return list.length;
  }

  async ltrim(key: string, start: number, stop: number) {
    const list = this.store.get(key);
    if (Array.isArray(list)) {
      this.store.set(key, list.slice(start, stop + 1));
    }
    return 'OK';
  }

  async lrange(key: string, start: number, stop: number) {
    const list = this.store.get(key);
    if (Array.isArray(list)) {
      return list; // Mock slicing for simplicity, or implement if needed
    }
    return [];
  }

  async incr(key: string) {
    return this.incrby(key, 1);
  }

  async llen(key: string) {
    const list = this.store.get(key);
    return Array.isArray(list) ? list.length : 0;
  }

  async expire(key: string, seconds: number) {
    // No-op for mock (TTL not tracked in-memory)
    return this.store.has(key) ? 1 : 0;
  }

  async exists(key: string) {
    return this.store.has(key) ? 1 : 0;
  }

  async ttl(key: string) {
    return this.store.has(key) ? -1 : -2; // -1 = no expiry, -2 = key missing
  }

  async del(key: string) {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  async keys(pattern: string) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  async hgetall(key: string) {
    const hash = this.store.get(key);
    return (hash && typeof hash === 'object' && !Array.isArray(hash)) ? hash : {};
  }

  async hset(key: string, field: string | Record<string, any>, value?: any) {
    const hash = this.ensureHash(key);
    if (typeof field === 'object' && field !== null) {
      Object.assign(hash, field);
      return Object.keys(field).length;
    }
    (hash as any)[field as string] = value;
    return 1;
  }

  async hincrby(key: string, field: string, increment: number) {
    const hash = this.ensureHash(key);
    const current = parseInt(hash[field] || '0');
    hash[field] = (current + increment).toString();
    return current + increment;
  }

  async hget(key: string, field: string) {
    const hash = this.store.get(key);
    if (hash && typeof hash === 'object' && !Array.isArray(hash)) {
      return hash[field] || null;
    }
    return null;
  }

  async hdel(key: string, field: string) {
    const hash = this.store.get(key);
    if (!hash || typeof hash !== 'object' || Array.isArray(hash) || !(field in hash)) {
      return 0;
    }
    delete hash[field];
    return 1;
  }

  async zincrby(key: string, increment: number, member: string) {
    const sortedSet = this.ensureSortedSet(key);
    const next = (sortedSet.get(member) || 0) + increment;
    sortedSet.set(member, next);
    return next;
  }

  async zadd(key: string, ...args: any[]) {
    const sortedSet = this.ensureSortedSet(key);
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      const entry = args[0];
      sortedSet.set(String(entry.member), Number(entry.score));
      return 1;
    }
    if (args.length >= 2) {
      sortedSet.set(String(args[1]), Number(args[0]));
      return 1;
    }
    return 0;
  }

  async zrange(key: string, start: number, stop: number, options?: { rev?: boolean; withScores?: boolean }) {
    const sortedSet = this.ensureSortedSet(key);
    const entries = Array.from(sortedSet.entries()).sort((a, b) =>
      options?.rev ? b[1] - a[1] : a[1] - b[1]
    );
    const sliced = entries.slice(start, stop + 1);
    if (options?.withScores) {
      return sliced.flatMap(([member, score]) => [member, score]);
    }
    return sliced.map(([member]) => member);
  }

  async sadd(key: string, ...members: string[]) {
    const set = this.ensureSet(key);
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added += 1;
      }
    }
    return added;
  }

  async smembers(key: string) {
    return Array.from(this.ensureSet(key).values());
  }

  async srem(key: string, ...members: string[]) {
    const set = this.ensureSet(key);
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed += 1;
      }
    }
    return removed;
  }

  pipeline() {
    const self = this;
    const operations: Function[] = [];
    const chain = {
      incr: (k: string) => { operations.push(() => { const v = parseInt(self.store.get(k) || '0'); self.store.set(k, v + 1); }); return chain; },
      incrby: (k: string, n: number) => { operations.push(() => { const v = parseInt(self.store.get(k) || '0'); self.store.set(k, v + n); }); return chain; },
      incrbyfloat: (k: string, n: number) => { operations.push(() => { const v = parseFloat(self.store.get(k) || '0.0'); self.store.set(k, v + n); }); return chain; },
      expire: (k: string, s: number) => { operations.push(() => { }); return chain; },
      lpush: (k: string, ...vals: any[]) => { operations.push(() => { if (!self.store.has(k)) self.store.set(k, []); const l = self.store.get(k); if (Array.isArray(l)) l.unshift(...vals); }); return chain; },
      ltrim: (k: string, start: number, stop: number) => { operations.push(() => { const l = self.store.get(k); if (Array.isArray(l)) self.store.set(k, l.slice(start, stop + 1)); }); return chain; },
      zadd: (k: string, ...args: any[]) => { operations.push(() => { self.zadd(k, ...args); }); return chain; },
      exec: async () => { for (const op of operations) op(); return []; }
    };
    return chain;
  }
  async appendToSession(sessionId: string, data: any) {
    const key = `session:${sessionId}:history`;
    await this.lpush(key, JSON.stringify(data));
    await this.ltrim(key, 0, 99); // Keep last 100
    return true;
  }

  async getSessionHistory(sessionId: string) {
    const key = `session:${sessionId}:history`;
    const items = await this.lrange(key, 0, -1);
    return items.map(item => JSON.parse(item as string));
  }
}

const mockRedisInstance = new MockRedis();
let redisClient: any;
let isMock = false;

// Initialize
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log("⚡ Using Upstash Redis (HTTP)");
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else {
    throw new Error("Missing Credentials");
  }
} catch (e) {
  console.warn("⚠️ Redis Credentials Missing. Using In-Memory Mock.");
  redisClient = mockRedisInstance;
  isMock = true;
}

// Proxy to catch runtime Auth failures and switch to mock
export const redis = new Proxy({}, {
  get: (target, prop) => {
    // ...
    if (prop === 'isMock') return isMock; // Add a way to check if we are in mock mode

    // ...
    if (isMock) return (redisClient as any)[prop];

    return async (...args: any[]) => {
      try {
        // @ts-ignore
        return await redisClient[prop](...args);
      } catch (err: any) {
        if (err.message && (err.message.includes("WRONGPASS") || err.message.includes("Unauthorized") || err.message.includes("Invalid token"))) {
          if (!isMock) {
            console.warn("⚠️ Redis Auth Failed during op. Switching to In-Memory Mock.");
            redisClient = mockRedisInstance;
            isMock = true;
          }
          // Retry with mock
          // @ts-ignore
          return await redisClient[prop](...args);
        }
        throw err;
      }
    };
  }
}) as any;
