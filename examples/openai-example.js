/**
 * AgentCache + OpenAI Integration Example
 * 
 * This example shows how to wrap OpenAI calls with AgentCache
 * to get instant responses and save 95% on costs.
 */

const OpenAI = require('openai');
const AgentCache = require('agentcache-sdk');

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const cache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY || 'ac_demo_test123',
  baseUrl: 'https://agentcache.ai/api'
});

/**
 * Cached chat completion
 * 
 * First call: Hits OpenAI (~3-8s, $$$)
 * Next calls: Instant from cache (<50ms, $0)
 */
async function cachedChatCompletion(messages, model = 'gpt-4') {
  console.log('🔍 Checking cache...');
  
  // 1. Check cache first
  const cached = await cache.get({
    provider: 'openai',
    model,
    messages,
    temperature: 0.7
  });

  if (cached.hit) {
    console.log('✅ Cache HIT! Latency:', cached.latency + 'ms');
    console.log('💰 Saved:', cached.saved);
    return cached.response;
  }

  console.log('❌ Cache miss, calling OpenAI...');
  
  // 2. Call OpenAI if not cached
  const startTime = Date.now();
  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7
  });
  
  const latency = Date.now() - startTime;
  const content = response.choices[0].message.content;
  
  console.log('📡 OpenAI responded in', latency + 'ms');
  
  // 3. Cache the response for next time
  await cache.set({
    provider: 'openai',
    model,
    messages,
    temperature: 0.7,
    response: content,
    ttl: 604800 // 7 days
  });
  
  console.log('💾 Cached for next time!');
  
  return content;
}

/**
 * Example usage
 */
async function main() {
  const question = 'What is the capital of France?';
  
  console.log('\n=== First Call (OpenAI) ===');
  const answer1 = await cachedChatCompletion([
    { role: 'user', content: question }
  ]);
  console.log('Answer:', answer1);
  
  console.log('\n=== Second Call (Cache) ===');
  const answer2 = await cachedChatCompletion([
    { role: 'user', content: question }
  ]);
  console.log('Answer:', answer2);
  
  // Get stats
  console.log('\n=== Your Savings ===');
  const stats = await cache.stats();
  console.log(`Cache hit rate: ${stats.hit_rate}%`);
  console.log(`Money saved: $${stats.cost_saved}`);
  console.log(`Requests: ${stats.used}/${stats.monthlyQuota}`);
}

main().catch(console.error);

/**
 * Expected output:
 * 
 * === First Call (OpenAI) ===
 * 🔍 Checking cache...
 * ❌ Cache miss, calling OpenAI...
 * 📡 OpenAI responded in 3240ms
 * 💾 Cached for next time!
 * Answer: The capital of France is Paris.
 * 
 * === Second Call (Cache) ===
 * 🔍 Checking cache...
 * ✅ Cache HIT! Latency: 42ms
 * 💰 Saved: ~$0.01-$1.00
 * Answer: The capital of France is Paris.
 * 
 * === Your Savings ===
 * Cache hit rate: 50%
 * Money saved: $0.50
 * Requests: 2/10000
 */
