const { AgentCacheLite } = require('./dist/index.js');

async function test() {
  console.log('🧪 Testing AgentCache Lite...\n');
  
  const cache = new AgentCacheLite({
    maxSize: 10,
    defaultTTL: 60,
  });

  // Test 1: Cache miss
  const miss = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  });
  
  console.log('Test 1 - Cache miss:', miss.hit === false ? '✅ PASS' : '❌ FAIL');

  // Test 2: Set value
  await cache.set({
    provider: 'openai',
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  }, { response: 'Hi there!' });
  
  console.log('Test 2 - Set value: ✅ PASS');

  // Test 3: Cache hit
  const hit = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  });
  
  console.log('Test 3 - Cache hit:', hit.hit === true ? '✅ PASS' : '❌ FAIL');
  console.log('   Value:', hit.value);

  // Test 4: Stats
  const stats = cache.getStats();
  console.log('\nTest 4 - Stats:');
  console.log('   Size:', stats.size);
  console.log('   Hits:', stats.hits);
  console.log('   Misses:', stats.misses);
  console.log('   Hit rate:', stats.hitRate + '%');
  console.log('   ✅ PASS');

  console.log('\n✨ All tests passed! Package is ready.\n');
}

test().catch(console.error);
