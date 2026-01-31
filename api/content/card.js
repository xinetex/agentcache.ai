import { Redis } from '@upstash/redis';
import { DEFAULT_LANES, DEFAULT_CARDS } from '../../src/config/bentoDefaults.js';

export const config = { runtime: 'edge' };

const CONTENT_KEY = 'content:v1';

function withCors(headers = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    ...headers,
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: withCors({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    }),
  });
}

let redis;
function getRedis() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = Redis.fromEnv();
  }
  return redis;
}

function getDefaultContent() {
  return {
    lanes: DEFAULT_LANES,
    cards: DEFAULT_CARDS,
  };
}

function getBearerToken(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return auth.trim();
}

function isAdmin(req) {
  const token = getBearerToken(req);
  return !!token && !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: withCors() });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!isAdmin(req)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json();
    const { id, laneId, template, data } = body || {};

    if (!id || !laneId || !data) {
      return json({ error: 'Missing required fields', required: ['id', 'laneId', 'data'] }, 400);
    }

    const db = getRedis();
    if (!db) {
      return json({ error: 'Redis not configured' }, 503);
    }

    const stored = await db.get(CONTENT_KEY);
    let content = getDefaultContent();

    if (stored && typeof stored === 'string') {
      try {
        content = JSON.parse(stored);
      } catch {
        content = getDefaultContent();
      }
    }

    if (!Array.isArray(content.lanes)) content.lanes = [];
    if (!Array.isArray(content.cards)) content.cards = [];

    // Ensure lane exists
    if (!content.lanes.find((l) => l?.id === laneId)) {
      content.lanes.push({
        id: laneId,
        title: laneId.toUpperCase(),
        size: 'medium',
        speed: 4000,
      });
    }

    const normalized = {
      id,
      laneId,
      template: template || 'standard',
      data,
    };

    const existingIdx = content.cards.findIndex((c) => c?.id === id);
    if (existingIdx >= 0) {
      content.cards[existingIdx] = normalized;
    } else {
      content.cards.push(normalized);
    }

    await db.set(CONTENT_KEY, JSON.stringify(content));

    return json({ success: true, id });
  } catch (e) {
    return json({ error: 'Failed to save card' }, 500);
  }
}
