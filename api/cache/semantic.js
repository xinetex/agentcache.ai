import { withAuth } from '../../lib/auth-unified.js';
import { Index } from "@upstash/vector";

export const config = { runtime: 'edge' };

// L3 Semantic Cache API
// POST /api/cache/semantic
// Uses OpenAI embeddings + cosine similarity for semantic matching
// Feature flag: ENABLE_L3_CACHE

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, X-API-Key, Authorization, X-Cache-Namespace'
    }
  });
}

// ... helper functions (generateEmbedding, cosineSimilarity, searchSemanticCache, storeSemanticCache) remain the same ...
// Note: We need to keep the helper functions in the file or move them to a library. 
// For this refactor, I will assume the helper functions are still present in the file but I am only replacing the handler and imports.
// However, since replace_file_content replaces a block, I need to be careful.
// The previous file content showed helper functions from line 58 to 218.
// I will target the top of the file and the handler function.

// Wait, I should probably do this in two chunks or replace the whole file if I want to be clean, 
// but replace_file_content is better for chunks.
// Let's replace the top imports and the handler.

// Actually, I need to make sure I don't delete the helper functions.
// I'll use multi_replace_file_content to be safe and precise.

import { generateEmbedding } from '../../src/lib/llm/embeddings.js';

const VECTOR_URL = process.env.UPSTASH_VECTOR_REST_URL;
const VECTOR_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;

let index = null;
if (VECTOR_URL && VECTOR_TOKEN) {
  index = new Index({
    url: VECTOR_URL,
    token: VECTOR_TOKEN,
  });
}

async function searchSemanticCache(text, namespace, provider, model, threshold = 0.85) {
  if (!index) return null;

  try {
    const results = await index.query({
      data: text,
      topK: 1,
      includeMetadata: true
    });

    if (results.length > 0) {
      const match = results[0];
      if (match.score >= threshold) {
        return {
          response: match.metadata.response,
          similarity: match.score,
          cached_at: match.metadata.cached_at,
          ttl: match.metadata.ttl
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Vector search error:', err);
    return null;
  }
}

async function storeSemanticCache(text, request, response, namespace) {
  if (!index) return null;

  // Generate hash of request (for unique key)
  const requestStr = JSON.stringify({
    provider: request.provider,
    model: request.model,
    messages: request.messages
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(requestStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Build key
  const nsPrefix = namespace ? `ns:${namespace}:` : '';
  const key = `${nsPrefix}semantic:v1:${request.provider}:${request.model}:${hash}`;
  const ttl = request.ttl || 604800; // 7 days default

  try {
    await index.upsert({
      id: key,
      data: text,
      metadata: {
        response: response,
        cached_at: new Date().toISOString(),
        ttl: ttl,
        provider: request.provider,
        model: request.model,
        namespace: namespace
      }
    });
    return key;
  } catch (err) {
    console.error('Vector store error:', err);
    return null;
  }
}

export default withAuth(async (req, auth) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type, X-API-Key, Authorization, X-Cache-Namespace'
      }
    });
  }

  // Check feature flag
  if (process.env.ENABLE_L3_CACHE !== 'true') {
    return json({
      error: 'Semantic cache not enabled',
      message: 'L3 semantic cache is currently behind a feature flag. Contact support to enable.'
    }, 503);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Tier Enforcement: L3 Semantic Cache is a Pro feature
  if (auth.key.tier !== 'pro') {
    return json({
      error: 'Upgrade required',
      message: 'L3 Semantic Cache is available only on the Pro plan.',
      upgrade_url: 'https://agentcache.ai/pricing.html'
    }, 403);
  }

  try {
    // Parse request
    const body = await req.json();
    const {
      action,  // 'search' or 'store'
      provider,
      model,
      messages,
      response,
      threshold = 0.85,
      ttl
    } = body;

    if (!action || !provider || !model || !messages) {
      return json({
        error: 'Missing required fields',
        required: ['action', 'provider', 'model', 'messages']
      }, 400);
    }

    // Get namespace
    const namespace = req.headers.get('x-cache-namespace');

    // Convert messages to text for embedding
    const messagesText = messages.map(m =>
      `${m.role}: ${m.content}`
    ).join('\n');

    const startTime = Date.now();

    // Generate embedding
    const embedding = await generateEmbedding(messagesText);
    const embeddingTime = Date.now() - startTime;

    if (action === 'search') {
      // Search for semantic match
      const match = await searchSemanticCache(
        messagesText,
        namespace,
        provider,
        model,
        threshold
      );

      if (match) {
        // Semantic cache hit
        return json({
          hit: true,
          tier: 'L3_SEMANTIC',
          response: match.response,
          similarity: match.similarity,
          threshold: threshold,
          cached_at: match.cached_at,
          latency: {
            total_ms: Date.now() - startTime,
            embedding_ms: embeddingTime,
            search_ms: Date.now() - startTime - embeddingTime
          },
          billing: {
            hit: true,
            cost_saved: 0.045, // avg GPT-4 request cost
            embedding_cost: 0.00001 // text-embedding-3-small cost
          }
        });
      } else {
        // Semantic cache miss
        return json({
          hit: false,
          tier: 'L3_SEMANTIC',
          message: 'No semantically similar cached response found',
          threshold: threshold,
          latency: {
            total_ms: Date.now() - startTime,
            embedding_ms: embeddingTime
          }
        }, 404);
      }

    } else if (action === 'store') {
      // Store in semantic cache
      if (!response) {
        return json({ error: 'Missing response to cache' }, 400);
      }

      const cacheKey = await storeSemanticCache(
        messagesText,
        { provider, model, messages, ttl },
        response,
        namespace
      );

      // Publish event for live visualization
      // Fire and forget
      const eventData = {
        type: 'new_node',
        category: 'analysis', // TODO: Infer category from model/content
        embedding: embedding.slice(0, 3), // Send only first 3 dims for 3D viz (simplified)
        tokens: JSON.stringify(response).length / 4, // Approx tokens
        text: messages[messages.length - 1].content.substring(0, 50) + '...',
        timestamp: Date.now()
      };

      const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
      const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (UPSTASH_URL && UPSTASH_TOKEN) {
        fetch(`${UPSTASH_URL}/publish/semantic-cache-events/${JSON.stringify(eventData)}`, {
          headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
        }).catch(err => console.error('Failed to publish event:', err));
      }

      return json({
        cached: true,
        tier: 'L3_SEMANTIC',
        cache_key: cacheKey,
        latency: {
          total_ms: Date.now() - startTime,
          embedding_ms: embeddingTime,
          store_ms: Date.now() - startTime - embeddingTime
        }
      });

    } else {
      return json({
        error: 'Invalid action',
        valid_actions: ['search', 'store']
      }, 400);
    }

  } catch (err) {
    console.error('Semantic cache error:', err);
    return json({
      error: 'Semantic cache operation failed',
      details: err.message
    }, 500);
  }
});
