import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const redisStore = new Map<string, string>();

vi.mock('@upstash/redis', () => {
  class MockPipeline {
    incr(key: string) {
      const current = Number(redisStore.get(key) || '0');
      redisStore.set(key, String(current + 1));
      return this;
    }

    expire(_key: string, _seconds: number) {
      return this;
    }

    zadd(_key: string, _entry: { score: number; member: string }) {
      return this;
    }

    lpush(key: string, value: string) {
      const current = JSON.parse(redisStore.get(key) || '[]');
      current.unshift(value);
      redisStore.set(key, JSON.stringify(current.slice(0, 100)));
      return this;
    }

    ltrim(_key: string, _start: number, _stop: number) {
      return this;
    }

    async exec() {
      return [];
    }
  }

  class MockRedis {
    pipeline() {
      return new MockPipeline();
    }

    async get(key: string) {
      return redisStore.get(key) || null;
    }
  }

  return { Redis: MockRedis };
});

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('customer usage tracking middleware', () => {
  it('classifies audio1.tv status traffic as CDN streaming instead of other', async () => {
    redisStore.clear();
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.local';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    const { customerUsageTracking } = await import('../../src/middleware/customerUsageTracking.js');

    const app = new Hono();
    app.use('*', customerUsageTracking);
    app.get('/api/cdn/status', (c) => c.json({ ok: true }));

    const response = await app.request('/api/cdn/status');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Customer-Id')).toBe('audio1_tv');
    expect(response.headers.get('X-Service-Category')).toBe('cdn_streaming');
    expect(response.headers.get('X-Response-Time')).toMatch(/ms$/);
  });

  it('tracks customer traffic for realtime usage summaries', async () => {
    redisStore.clear();
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.local';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    const { customerUsageTracking, getRealtimeUsage } = await import('../../src/middleware/customerUsageTracking.js');

    const app = new Hono();
    app.use('*', customerUsageTracking);
    app.get('/api/claw/agent', (c) => c.json({ ok: true }));
    app.get('/api/cdn/status', (c) => c.json({ ok: true }));

    await app.request('/api/claw/agent');
    await app.request('/api/cdn/status');
    await flushAsyncWork();

    const usage = await getRealtimeUsage();
    expect(usage).not.toBeNull();

    const audio1 = usage.customers.find((customer: any) => customer.id === 'audio1_tv');
    const clawsave = usage.customers.find((customer: any) => customer.id === 'clawsave_com');

    expect(audio1.totalRequests).toBeGreaterThanOrEqual(1);
    expect(clawsave.totalRequests).toBeGreaterThanOrEqual(1);
  });

  it('classifies jettythunder proxy and storage routes into their billing categories', async () => {
    redisStore.clear();
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.local';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    const { customerUsageTracking } = await import('../../src/middleware/customerUsageTracking.js');

    const app = new Hono();
    app.use('*', customerUsageTracking);
    app.post('/api/edges/optimal', (c) => c.json({ ok: true }));
    app.post('/api/jetty-speed/chunk', (c) => c.json({ ok: true }));
    app.post('/api/muscle/plan', (c) => c.json({ ok: true }));
    app.get('/api/s3/presigned', (c) => c.json({ ok: true }));

    const edges = await app.request('/api/edges/optimal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 1, lng: 2 }),
    });
    expect(edges.headers.get('X-Customer-Id')).toBe('jettythunder_app');
    expect(edges.headers.get('X-Service-Category')).toBe('edge_routing');

    const chunk = await app.request('/api/jetty-speed/chunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });
    expect(chunk.headers.get('X-Customer-Id')).toBe('jettythunder_app');
    expect(chunk.headers.get('X-Service-Category')).toBe('chunk_caching');

    const muscle = await app.request('/api/muscle/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: 'optimize-upload' }),
    });
    expect(muscle.headers.get('X-Customer-Id')).toBe('jettythunder_app');
    expect(muscle.headers.get('X-Service-Category')).toBe('ai_processing');

    const presigned = await app.request('/api/s3/presigned');
    expect(presigned.headers.get('X-Customer-Id')).toBe('jettythunder_app');
    expect(presigned.headers.get('X-Service-Category')).toBe('file_provisioning');
  });

  it('skips non-customer routes without adding tracking headers', async () => {
    redisStore.clear();
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.local';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    const { customerUsageTracking } = await import('../../src/middleware/customerUsageTracking.js');

    const app = new Hono();
    app.use('*', customerUsageTracking);
    app.get('/api/not-customer-scoped', (c) => c.json({ ok: true }));

    const response = await app.request('/api/not-customer-scoped');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Customer-Id')).toBeNull();
    expect(response.headers.get('X-Service-Category')).toBeNull();
  });
});
