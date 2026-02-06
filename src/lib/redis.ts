
import { Redis } from '@upstash/redis';

// Simple In-Memory Mock for offline/dev mode
class MockRedis {
  private store = new Map<string, any>();

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

  async hgetall(key: string) {
    const hash = this.store.get(key);
    return (hash && typeof hash === 'object' && !Array.isArray(hash)) ? hash : {};
  }

  async hincrby(key: string, field: string, increment: number) {
    if (!this.store.has(key) || typeof this.store.get(key) !== 'object') {
      this.store.set(key, {});
    }
    const hash = this.store.get(key);
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

  pipeline() {
    // Return a mock pipeline that just executes immediately or buffers
    const self = this;
    const operations: Function[] = [];
    return {
      incr: (k: string) => operations.push(() => {
        const v = parseInt(self.store.get(k) || '0');
        self.store.set(k, v + 1);
      }),
      incrby: (k: string, n: number) => operations.push(() => {
        const v = parseInt(self.store.get(k) || '0');
        self.store.set(k, v + n);
      }),
      incrbyfloat: (k: string, n: number) => operations.push(() => {
        const v = parseFloat(self.store.get(k) || '0.0');
        self.store.set(k, v + n);
      }),
      exec: async () => {
        for (const op of operations) op();
        return [];
      }
    };
  }
}

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
  redisClient = new MockRedis();
  isMock = true;
}

// Proxy to catch runtime Auth failures and switch to mock
export const redis = new Proxy({}, {
  get: (target, prop) => {
    if (isMock) return (redisClient as any)[prop];

    return async (...args: any[]) => {
      try {
        // @ts-ignore
        return await redisClient[prop](...args);
      } catch (err: any) {
        if (err.message && (err.message.includes("WRONGPASS") || err.message.includes("Unauthorized"))) {
          console.warn("⚠️ Redis Auth Failed during op. Switching to In-Memory Mock.");
          redisClient = new MockRedis();
          isMock = true;
          // Retry with mock
          // @ts-ignore
          return await redisClient[prop](...args);
        }
        throw err;
      }
    };
  }
}) as unknown as Redis;
