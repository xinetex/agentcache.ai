/**
 * Example: Redis with AgentCache Overflow
 * 
 * Shows how to integrate AgentCache as fallback layer for Redis
 * Redis = fast local cache
 * AgentCache = global edge overflow
 */

const Redis = require('ioredis');
const AgentCacheOverflow = require('@agentcache/overflow-client');

// Initialize Redis (primary cache)
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null // Fail fast
});

// Initialize AgentCache (overflow/fallback)
const agentcache = new AgentCacheOverflow({
  partnerId: 'redis-labs',
  apiKey: process.env.AGENTCACHE_PARTNER_KEY,
  revenueShare: 0.30  // Redis gets 30% of cache revenue
});

/**
 * Smart cache lookup with overflow to AgentCache
 */
async function getCachedLLMResponse(customerId, request) {
  // Generate cache key
  const cacheKey = generateCacheKey(request);
  
  try {
    // 1. Try Redis first (fast local lookup)
    const localCached = await redis.get(cacheKey);
    
    if (localCached) {
      console.log('✓ Redis HIT:', cacheKey);
      return {
        response: JSON.parse(localCached),
        source: 'redis',
        latency: '<5ms'
      };
    }
    
    console.log('✗ Redis MISS, checking AgentCache...');
    
  } catch (err) {
    console.warn('Redis error, falling back to AgentCache:', err.message);
  }
  
  // 2. Redis miss or error → check AgentCache (global edge)
  const agentcacheResult = await agentcache.get({
    customerId: customerId,
    request: request,
    metadata: {
      redis_checked: true,
      timestamp: Date.now()
    }
  });
  
  if (agentcacheResult.hit) {
    console.log('✓ AgentCache HIT:', agentcacheResult.latency + 'ms');
    
    // Store in Redis for future local hits
    try {
      await redis.setex(cacheKey, 604800, JSON.stringify(agentcacheResult.response));
    } catch (err) {
      console.warn('Failed to populate Redis:', err.message);
    }
    
    return {
      response: agentcacheResult.response,
      source: 'agentcache',
      latency: agentcacheResult.latency + 'ms',
      billing: agentcacheResult.billing
    };
  }
  
  console.log('✗ AgentCache MISS - need to call LLM');
  return null;
}

/**
 * Store LLM response in both Redis and AgentCache
 */
async function setCachedLLMResponse(customerId, request, response) {
  const cacheKey = generateCacheKey(request);
  
  // Store in Redis (local)
  try {
    await redis.setex(cacheKey, 604800, JSON.stringify(response));
    console.log('✓ Stored in Redis:', cacheKey);
  } catch (err) {
    console.warn('Redis store error:', err.message);
  }
  
  // Store in AgentCache (global edge)
  const result = await agentcache.set({
    customerId: customerId,
    request: request,
    response: response
  });
  
  if (result.success) {
    console.log('✓ Stored in AgentCache:', result.cacheKey);
  } else {
    console.warn('AgentCache store error:', result.error);
  }
}

/**
 * Complete workflow: check cache, call LLM if needed, store result
 */
async function getLLMResponse(customerId, request) {
  // Try cache first (Redis → AgentCache)
  const cached = await getCachedLLMResponse(customerId, request);
  
  if (cached) {
    return cached;
  }
  
  // Cache miss - call LLM
  console.log('Calling LLM...');
  const response = await callLLM(request);
  
  // Store in both caches
  await setCachedLLMResponse(customerId, request, response);
  
  return {
    response: response,
    source: 'llm',
    latency: '~2000ms'
  };
}

/**
 * Mock LLM call (replace with actual OpenAI/Anthropic call)
 */
async function callLLM(request) {
  // Simulate LLM API call
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    role: 'assistant',
    content: 'This is a mock LLM response. Replace with actual LLM call.',
    model: request.model,
    tokens: 150
  };
}

/**
 * Generate cache key from request
 */
function generateCacheKey(request) {
  const crypto = require('crypto');
  const normalized = JSON.stringify({
    provider: request.provider,
    model: request.model,
    messages: request.messages,
    temperature: request.temperature || 0
  });
  
  return `llm:${crypto.createHash('sha256').update(normalized).digest('hex')}`;
}

// Example usage
async function main() {
  console.log('\n=== Redis + AgentCache Overflow Example ===\n');
  
  const customerId = 'customer_123';
  const request = {
    provider: 'openai',
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ],
    temperature: 0
  };
  
  // First call - cache miss (call LLM)
  console.log('--- First call ---');
  const result1 = await getLLMResponse(customerId, request);
  console.log('Result:', result1);
  
  // Second call - Redis hit
  console.log('\n--- Second call (same request) ---');
  const result2 = await getLLMResponse(customerId, request);
  console.log('Result:', result2);
  
  // Third call from different customer - AgentCache hit
  console.log('\n--- Third call (different customer, same request) ---');
  // Clear Redis to simulate different server
  await redis.del(generateCacheKey(request));
  const result3 = await getLLMResponse('customer_456', request);
  console.log('Result:', result3);
  
  // Show stats
  console.log('\n--- AgentCache Overflow Stats ---');
  console.log(agentcache.getStats());
  
  // Cleanup
  redis.disconnect();
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  getCachedLLMResponse,
  setCachedLLMResponse,
  getLLMResponse
};
