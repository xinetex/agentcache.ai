/**
 * Basic Usage Example - AgentCache Lite
 * 
 * This demonstrates the simplest possible integration.
 */

import { AgentCacheLite } from '../src/index';

const cache = new AgentCacheLite({
  maxSize: 100,
  defaultTTL: 3600, // 1 hour
  telemetry: true,  // Get upgrade recommendations
});

async function main() {
  console.log('🚀 AgentCache Lite Example\n');

  // Example conversation
  const messages = [
    { role: 'user', content: 'What is TypeScript?' }
  ];

  // First call - cache miss
  console.log('1️⃣ First request (cache miss expected)...');
  let result = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages,
  });

  if (result.hit) {
    console.log('✅ Cache hit!', result.value);
  } else {
    console.log('❌ Cache miss - simulating LLM call...');
    
    // Simulate LLM response
    const llmResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        message: {
          role: 'assistant',
          content: 'TypeScript is a strongly typed programming language that builds on JavaScript.'
        },
        finish_reason: 'stop',
        index: 0,
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25,
      }
    };

    // Store in cache
    await cache.set({
      provider: 'openai',
      model: 'gpt-4',
      messages,
    }, llmResponse);

    console.log('💾 Cached response for future requests\n');
  }

  // Second call - cache hit
  console.log('2️⃣ Second request (cache hit expected)...');
  result = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages,
  });

  if (result.hit) {
    console.log(`✅ Cache hit! Age: ${result.age}s`);
    console.log('Response:', result.value.choices[0].message.content);
    console.log('\n💰 Saved ~$0.03 on this request!\n');
  }

  // Show stats
  const stats = cache.getStats();
  console.log('📊 Cache Statistics:');
  console.log(`   Total requests: ${stats.hits + stats.misses}`);
  console.log(`   Cache hits: ${stats.hits}`);
  console.log(`   Cache misses: ${stats.misses}`);
  console.log(`   Hit rate: ${stats.hitRate}%`);
  console.log(`   Cache size: ${stats.size}/${stats.maxSize}`);
  console.log(`   Memory: ${stats.memoryEstimate}`);
}

main().catch(console.error);
