// src/store.js — pluggable key/value store for the AgentCache engine.
//
// The engine only needs get/set/del. MemoryStore is the zero-dependency
// default (great for tests, single-process, and the demo). RedisStore adapts
// any Upstash-style client ({ get, set, del }) so the exact same engine runs
// against the org's real Redis in production.

export class MemoryStore {
  constructor() {
    this.map = new Map();
  }
  async get(key) {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return e.v;
  }
  async set(key, value, ttlSeconds) {
    this.map.set(key, { v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
  }
  async del(key) {
    this.map.delete(key);
  }
  get size() {
    return this.map.size;
  }
}

// Adapter over an Upstash-style client. Kept dependency-free: you pass the
// client in, so this module never imports @upstash/redis.
export class RedisStore {
  constructor(client, { keyPrefix = '' } = {}) {
    if (!client || typeof client.get !== 'function') {
      throw new Error('RedisStore requires a client with get/set/del');
    }
    this.client = client;
    this.keyPrefix = keyPrefix;
  }
  _k(key) {
    return this.keyPrefix + key;
  }
  async get(key) {
    return (await this.client.get(this._k(key))) ?? null;
  }
  async set(key, value, ttlSeconds) {
    if (ttlSeconds) return this.client.set(this._k(key), value, { ex: ttlSeconds });
    return this.client.set(this._k(key), value);
  }
  async del(key) {
    return this.client.del(this._k(key));
  }
}
