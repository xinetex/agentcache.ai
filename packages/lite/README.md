# @agentcache/lite

**Zero-dependency, in-memory cache for AI responses**  
Perfect for getting started. Upgrade to [AgentCache Standard](https://agentcache.ai/pricing) when you need persistence.

[![npm version](https://badge.fury.io/js/@agentcache%2Flite.svg)](https://www.npmjs.com/package/@agentcache/lite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why AgentCache Lite?

Stop paying for the same AI response twice. This lightweight, zero-dependency cache:

- ✅ **50 KB package** - No external dependencies
- ✅ **<1ms lookup** - In-memory LRU cache
- ✅ **Free forever** - No API keys, no limits
- ✅ **Drop-in simple** - 3 lines of code
- ✅ **Upgrade path** - Same API as AgentCache Standard/Pro

Perfect for:
- Development and testing
- Side projects with <10K requests/month
- Single-instance applications
- Prototyping cache strategies

## Installation

```bash
npm install @agentcache/lite
```

No configuration required. No API keys. Just import and use.

## Quick Start

```typescript
import { AgentCacheLite } from '@agentcache/lite';

const cache = new AgentCacheLite({
  maxSize: 100,        // Max 100 cached responses
  defaultTTL: 3600,    // 1 hour cache lifetime
});

// Check cache before calling LLM
const cached = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is TypeScript?' }],
});

if (cached.hit) {
  console.log('💚 Cache hit! Age:', cached.age, 'seconds');
  console.log('Response:', cached.value);
} else {
  // Call your LLM provider
  const response = await openai.chat.completions.create({...});
  
  // Store in cache
  await cache.set({
    provider: 'openai',
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'What is TypeScript?' }],
  }, response);
}
```

## API Reference

### Constructor

```typescript
const cache = new AgentCacheLite({
  maxSize?: number;      // Default: 100
  defaultTTL?: number;   // Default: 3600 (1 hour, in seconds)
  telemetry?: boolean;   // Default: false
  namespace?: string;    // Default: 'default'
});
```

### Methods

#### `cache.get(params)`

Check if response is cached and retrieve it.

```typescript
const result = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...],
  temperature?: 0.7
});

// Returns:
// { hit: false } - Cache miss
// { hit: true, value: any, age: number, namespace: string } - Cache hit
```

#### `cache.set(params, value, options?)`

Store a response in cache.

```typescript
await cache.set(
  {
    provider: 'openai',
    model: 'gpt-4',
    messages: [...]
  },
  responseData,
  { ttl: 7200 } // Optional: override default TTL
);
```

#### `cache.check(params)`

Check if cached without retrieving the value.

```typescript
const status = await cache.check({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...]
});

// Returns: { cached: boolean, ttl?: number }
```

#### `cache.getStats()`

Get cache performance statistics.

```typescript
const stats = cache.getStats();
// {
//   size: 45,
//   maxSize: 100,
//   hits: 230,
//   misses: 78,
//   hitRate: 74.68,
//   evictions: 12,
//   memoryEstimate: "0.09 MB"
// }
```

#### `cache.clear()`

Clear all cached entries.

```typescript
cache.clear();
```

#### `cache.delete(params)`

Delete a specific cache entry.

```typescript
const deleted = cache.delete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...]
});
```

## Real-World Examples

### OpenAI Integration

```typescript
import OpenAI from 'openai';
import { AgentCacheLite } from '@agentcache/lite';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cache = new AgentCacheLite({ maxSize: 200 });

async function getChatCompletion(messages) {
  // Check cache first
  const cached = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages,
  });

  if (cached.hit) {
    console.log(`💚 Saved ~$0.03 (${cached.age}s old)`);
    return cached.value;
  }

  // Cache miss - call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
  });

  // Store for next time
  await cache.set({
    provider: 'openai',
    model: 'gpt-4',
    messages,
  }, response);

  return response;
}
```

### Anthropic Claude

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AgentCacheLite } from '@agentcache/lite';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const cache = new AgentCacheLite();

async function askClaude(prompt) {
  const messages = [{ role: 'user', content: prompt }];
  
  const cached = await cache.get({
    provider: 'anthropic',
    model: 'claude-3-sonnet',
    messages,
  });

  if (cached.hit) return cached.value;

  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    messages,
    max_tokens: 1024,
  });

  await cache.set({
    provider: 'anthropic',
    model: 'claude-3-sonnet',
    messages,
  }, response);

  return response;
}
```

### Multi-Tenant with Namespaces

```typescript
import { AgentCacheLite } from '@agentcache/lite';

// Separate cache per customer
const customerCaches = new Map();

function getCacheForCustomer(customerId) {
  if (!customerCaches.has(customerId)) {
    customerCaches.set(customerId, new AgentCacheLite({
      namespace: `customer-${customerId}`,
      maxSize: 50,
    }));
  }
  return customerCaches.get(customerId);
}

// Use it
const cache = getCacheForCustomer('cust_123');
const result = await cache.get({...});
```

### Express Middleware

```typescript
import express from 'express';
import { AgentCacheLite } from '@agentcache/lite';

const app = express();
const cache = new AgentCacheLite({ maxSize: 500 });

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  
  const cached = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages,
  });

  if (cached.hit) {
    return res.json({
      ...cached.value,
      cached: true,
      age: cached.age,
    });
  }

  // Call LLM, store response
  const response = await callLLM(messages);
  await cache.set({ provider: 'openai', model: 'gpt-4', messages }, response);
  
  res.json({ ...response, cached: false });
});
```

## Performance Tips

### 1. **Tune Cache Size**

```typescript
// Small API (few users): 50-100 entries
const cache = new AgentCacheLite({ maxSize: 50 });

// Medium API (moderate traffic): 200-500 entries
const cache = new AgentCacheLite({ maxSize: 300 });

// Large API (high traffic): Upgrade to AgentCache Standard
// In-memory won't scale beyond ~1000 entries
```

### 2. **Set Appropriate TTLs**

```typescript
// FAQ bot - long TTL (questions don't change)
await cache.set(params, response, { ttl: 86400 }); // 24 hours

// Real-time data - short TTL
await cache.set(params, response, { ttl: 300 }); // 5 minutes

// Default - medium TTL
await cache.set(params, response); // 1 hour
```

### 3. **Monitor Hit Rates**

```typescript
setInterval(() => {
  const stats = cache.getStats();
  console.log(`Hit rate: ${stats.hitRate}%`);
  
  if (stats.hitRate > 60 && stats.evictions > 50) {
    console.log('⚠️ Consider upgrading to AgentCache Standard');
  }
}, 60000); // Every minute
```

## When to Upgrade

**Upgrade to [AgentCache Standard](https://agentcache.ai/pricing) ($29/mo) when:**

✅ You hit the 100-entry limit frequently  
✅ You need persistence across restarts  
✅ You run multiple app instances (need shared cache)  
✅ You want 50ms global edge latency  
✅ You need analytics and cost tracking  

**Migration is 1 line of code:**

```typescript
// Before (Lite)
import { AgentCacheLite } from '@agentcache/lite';
const cache = new AgentCacheLite();

// After (Standard)
import { AgentCache } from '@agentcache/standard';
const cache = new AgentCache({ apiKey: 'ac_live_xxx' });

// Same API - zero code changes! 🎉
```

## Comparison

| Feature | Lite | Standard | Professional |
|---------|------|----------|--------------|
| **Price** | Free | $29/mo | $199/mo |
| **Storage** | In-memory | Redis (persistent) | Redis + Vector DB |
| **Max Entries** | 100 | Unlimited | Unlimited |
| **Shared Cache** | ❌ | ✅ | ✅ |
| **Edge Latency** | N/A | <50ms | <50ms |
| **Semantic Search** | ❌ | ❌ | ✅ |
| **Analytics** | Basic | Advanced | Enterprise |
| **Multi-region** | ❌ | ✅ (20+ regions) | ✅ (200+ locations) |
| **Support** | Community | Email | Priority + Slack |

## FAQ

**Q: Does this work with streaming responses?**  
A: Yes! Cache the final concatenated response after streaming completes.

**Q: What happens when I restart my app?**  
A: Cache is cleared (in-memory only). Upgrade to Standard for persistence.

**Q: Can I use this in production?**  
A: Yes, for low-traffic apps (<10K requests/month). Use Standard for production scale.

**Q: Does this send data to AgentCache servers?**  
A: No! Lite runs 100% locally. Zero external calls.

**Q: How does key generation work?**  
A: Same input (provider, model, messages, temperature) = same key. Deterministic hashing.

**Q: Can I use this with Gemini/Cohere/Mistral?**  
A: Yes! Works with any LLM provider. Just change the `provider` parameter.

## Contributing

Found a bug? Have a feature request?  
[Open an issue](https://github.com/jettythunder/agentcache-ai/issues) or submit a PR!

## License

MIT © JettyThunder Labs

## Links

- 🌐 [AgentCache.ai](https://agentcache.ai)
- 📖 [Documentation](https://agentcache.ai/docs)
- 💬 [Discord Community](https://discord.gg/agentcache)
- 🐦 [Twitter](https://twitter.com/agentcache)

---

**Built by [JettyThunder Labs](https://jettythunder.app)**  
*Helping developers save thousands on AI costs*
