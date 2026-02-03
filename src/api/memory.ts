import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

import { authenticateApiKey } from '../middleware/auth.js';
import { queryMemory, upsertMemory, vectorIndex } from '../lib/vector.js';

const memoryRouter = new Hono();

function safeString(v: unknown) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}

memoryRouter.get('/health', async (c) => {
  // This endpoint intentionally does not require auth, so the Services page can check readiness.
  // It does not reveal secrets.
  return c.json({
    ok: true,
    service: 'memory',
    storage: {
      redis_configured: !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL),
      vector_service: process.env.VECTOR_SERVICE_URL ? 'configured' : 'mock',
    },
    timestamp: new Date().toISOString(),
  });
});

memoryRouter.post('/store', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const body = await c.req.json().catch(() => ({} as any));
  const content = safeString(body.content);

  if (!content || content.trim().length < 3) {
    return c.json({ error: 'content is required (min 3 chars)' }, 400);
  }

  // Prevent someone from stuffing huge blobs into Redis/vector metadata.
  if (content.length > 20_000) {
    return c.json({ error: 'content too large (max 20,000 chars)' }, 413);
  }

  const apiKey = c.get('apiKey');
  const keyHash = apiKey ? createHash('sha256').update(apiKey as string).digest('hex') : null;

  const id = uuidv4();
  const now = Date.now();

  const tags = Array.isArray(body.tags) ? body.tags.map(safeString).filter(Boolean).slice(0, 25) : [];
  const meta = typeof body.metadata === 'object' && body.metadata ? body.metadata : {};

  await upsertMemory(id, content, {
    ...meta,
    keyHash,
    tags,
    timestamp: now,
    source: 'agentcache_api',
  });

  return c.json({
    success: true,
    id,
    timestamp: now,
  }, 201);
});

memoryRouter.post('/recall', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const body = await c.req.json().catch(() => ({} as any));
  const query = safeString(body.query);

  if (!query || query.trim().length < 2) {
    return c.json({ error: 'query is required (min 2 chars)' }, 400);
  }

  const limitRaw = Number(body.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(10, Math.max(1, Math.floor(limitRaw))) : 5;

  const results = await queryMemory(query, limit);

  return c.json({
    success: true,
    query,
    count: results.length,
    results: results.map((r) => ({
      id: r.id,
      score: r.score,
      preview: safeString(r.data).slice(0, 240),
      metadata: r.metadata,
    })),
  });
});

memoryRouter.get('/:id', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id required' }, 400);

  const records = await vectorIndex.fetch([id], { includeVectors: false, includeMetadata: true });
  const record = records?.[0];

  if (!record) {
    return c.json({ error: 'Memory not found' }, 404);
  }

  return c.json({
    id,
    data: record.data,
    metadata: record.metadata,
  });
});

export default memoryRouter;
