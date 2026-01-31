import { Redis } from '@upstash/redis';
import { DEFAULT_LANES, DEFAULT_CARDS } from '../src/config/bentoDefaults.js';

export const config = { runtime: 'edge' };

const CONTENT_KEY = 'content:v1';

function withCors(headers = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
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

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: withCors() });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const db = getRedis();
    if (!db) {
      return json(getDefaultContent());
    }

    const stored = await db.get(CONTENT_KEY);
    if (!stored) {
      const initial = getDefaultContent();
      // Best-effort initialize so Mission Control can immediately edit.
      await db.set(CONTENT_KEY, JSON.stringify(initial));
      return json(initial);
    }

    if (typeof stored === 'string') {
      try {
        return json(JSON.parse(stored));
      } catch {
        return json(getDefaultContent());
      }
    }

    // If Upstash returns an object (unlikely for GET), pass through.
    let responseData = typeof stored === 'string' ? JSON.parse(stored) : stored;

    // Inject Settings
    try {
      const settings = await db.get('adminConfig:settings');
      if (settings) {
        responseData.settings = typeof settings === 'string' ? JSON.parse(settings) : settings;
      }
    } catch (e) {
      // ignore settings load failure
    }

    return json(responseData);
  } catch (e) {
    return json(getDefaultContent());
  }
}
