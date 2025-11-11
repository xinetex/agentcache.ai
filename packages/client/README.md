# agentcache-client

**JavaScript/TypeScript client for [AgentCache.ai](https://agentcache.ai)**

Edge caching for AI API calls. **90% cost reduction, 10x faster responses.**

```bash
npm install agentcache-client
```

## Quick Start

```typescript
import { AgentCache } from 'agentcache-client';

const cache = new AgentCache('ac_demo_test123'); // Get your key at agentcache.ai

// Check cache before calling LLM
const cached = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is Python?' }]
});

if (cached.hit) {
  console.log('✅ Cache hit!', cached.latency_ms + 'ms');
  return cached.response;
}

// Cache miss - call your LLM
const response = await callYourLLM();

// Store for next time
await cache.set({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is Python?' }],
  response: response
});
```

## Features

- ✅ **90% cost savings** - Cache identical prompts across all users
- ✅ **10x faster** - Global edge network with <50ms P95 latency  
- ✅ **Provider agnostic** - Works with OpenAI, Anthropic, Claude, Moonshot AI
- ✅ **TypeScript** - Full type safety out of the box
- ✅ **Zero config** - Just pass your API key
- ✅ **Namespace support** - Isolate cache by customer/workflow
- ✅ **Moonshot AI (Kimi K2)** - Reasoning token caching for 98% savings

## Installation

```bash
npm install agentcache-client
# or
yarn add agentcache-client
# or  
pnpm add agentcache-client
```

## Usage

### Basic Usage

```typescript
import { AgentCache } from 'agentcache-client';

const cache = new AgentCache({
  apiKey: 'ac_live_your_key',
  namespace: 'production', // optional
  defaultTtl: 604800 // 7 days (optional)
});

// Check cache
const result = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Explain caching' }
  ]
});

if (result.hit) {
  console.log('Cache hit!', result.response);
} else {
  // Call your LLM and store
  const llmResponse = await yourLLMCall();
  await cache.set({
    provider: 'openai',
    model: 'gpt-4',
    messages: [...],
    response: llmResponse
  });
}
```

### Moonshot AI (Kimi K2) - Reasoning Token Caching

**New!** AgentCache is the first caching service with dedicated reasoning token caching for Moonshot AI's Kimi K2.

```typescript
const result = await cache.moonshot({
  model: 'moonshot-v1-128k',
  messages: [
    { role: 'user', content: 'Analyze this entire codebase and find security vulnerabilities' }
  ],
  cache_reasoning: true // Cache reasoning tokens separately!
});

if (result.hit) {
  console.log('✅ Cache hit!', result.latency_ms + 'ms');
  console.log('Response:', result.response);
  
  if (result.reasoning) {
    console.log(`💡 Reasoning: ${result.reasoning.tokens} tokens, saved ${result.reasoning.cost_saved}`);
  }
}
```

**Cost Impact:**
- 100K token codebase analysis: $405/month → $8.10/month
- **98% savings** on reasoning-heavy queries!

### Namespace Isolation (Multi-Tenant)

```typescript
// Isolate cache by customer
const cache = new AgentCache({
  apiKey: 'ac_live_your_key',
  namespace: 'customer_abc'
});

// Or per-request
await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...],
  namespace: 'customer_xyz' // Override default namespace
});
```

### Usage Statistics

```typescript
const stats = await cache.stats('24h');

console.log(`Hit rate: ${stats.metrics.hit_rate}%`);
console.log(`Cost saved: ${stats.metrics.cost_saved}`);
console.log(`Tokens saved: ${stats.metrics.tokens_saved}`);

if (stats.quota) {
  console.log(`Quota: ${stats.quota.usage_percent}%`);
}
```

## API Reference

### `new AgentCache(config)`

Create a new AgentCache client.

```typescript
const cache = new AgentCache({
  apiKey: string,        // Required: Your AgentCache API key
  baseUrl?: string,      // Optional: API base URL (default: https://agentcache.ai)
  namespace?: string,    // Optional: Default namespace (default: 'default')
  defaultTtl?: number    // Optional: Default TTL in seconds (default: 604800 = 7 days)
});

// Or shorthand
const cache = new AgentCache('ac_live_your_key');
```

### `cache.get(options)`

Check if response is cached.

**Options:**
- `provider` (string): LLM provider ('openai', 'anthropic', 'moonshot', etc.)
- `model` (string): Model name ('gpt-4', 'claude-3-opus', etc.)
- `messages` (array): Array of message objects
- `temperature?` (number): Temperature parameter
- `namespace?` (string): Override default namespace

**Returns:** `Promise<CacheGetResponse>`

```typescript
{
  hit: boolean,
  response?: string | any,
  cached_at?: string,
  latency_ms?: number
}
```

### `cache.set(options)`

Store response in cache.

**Options:**
- Same as `get()`, plus:
- `response` (any): The LLM response to cache
- `ttl?` (number): Time-to-live in seconds

**Returns:** `Promise<CacheSetResponse>`

### `cache.moonshot(options)`

Call Moonshot AI with reasoning token caching.

**Options:**
- `model?` (string): Moonshot model (default: 'moonshot-v1-128k')
- `messages` (array): Array of message objects
- `temperature?` (number): Temperature parameter
- `cache_reasoning?` (boolean): Cache reasoning tokens (default: true)
- `namespace?` (string): Override default namespace

**Returns:** `Promise<MoonshotResponse>`

```typescript
{
  hit: boolean,
  response: string,
  reasoning?: {
    tokens: number,
    cost_saved: string,
    cached: boolean
  },
  cached_at?: string,
  latency_ms: number
}
```

### `cache.stats(period?)`

Get usage statistics.

**Parameters:**
- `period?` ('1h' | '24h' | '7d' | '30d'): Time period (default: '24h')

**Returns:** `Promise<StatsResponse>`

## ROI Example

**Before AgentCache:**
```
100,000 GPT-4 calls/month × $0.03 = $3,000/month
```

**After AgentCache (85% hit rate):**
```
15,000 uncached × $0.03 = $450
85,000 cached × $0 = $0
AgentCache Pro = $49
─────────────────────────
Total: $499/month
💰 SAVE $2,501/MONTH (83%)
```

## Environment Variables

For server-side usage, you can use environment variables:

```bash
AGENTCACHE_API_KEY=ac_live_your_key
AGENTCACHE_NAMESPACE=production
```

```typescript
const cache = new AgentCache(process.env.AGENTCACHE_API_KEY!);
```

## Error Handling

```typescript
try {
  const result = await cache.get({...});
} catch (error) {
  console.error('AgentCache error:', error.message);
  // Fallback to direct LLM call
  const response = await callLLMDirectly();
}
```

## TypeScript Support

Full TypeScript support with complete type definitions:

```typescript
import { 
  AgentCache, 
  CacheGetOptions, 
  CacheGetResponse,
  MoonshotOptions,
  StatsResponse 
} from 'agentcache-client';
```

## Links

- **Website**: [https://agentcache.ai](https://agentcache.ai)
- **Documentation**: [https://agentcache.ai/docs.html](https://agentcache.ai/docs.html)
- **GitHub**: [https://github.com/xinetex/agentcache.ai](https://github.com/xinetex/agentcache.ai)
- **Get API Key**: [https://agentcache.ai/#signup](https://agentcache.ai/#signup)

## License

MIT © AgentCache.ai

## Support

- Email: support@agentcache.ai
- Issues: [GitHub Issues](https://github.com/xinetex/agentcache.ai/issues)
