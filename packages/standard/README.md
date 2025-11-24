# @agentcache/standard

**Production-grade AI response caching with Redis persistence**  
Drop-in upgrade from [@agentcache/lite](https://www.npmjs.com/package/@agentcache/lite) with the same API.

[![npm version](https://badge.fury.io/js/@agentcache%2Fstandard.svg)](https://www.npmjs.com/package/@agentcache/standard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why AgentCache Standard?

Upgrade from Lite when you need:

- ✅ **Redis persistence** - Cache survives restarts
- ✅ **Unlimited cache size** - No 100-entry limit
- ✅ **Shared cache** - Multiple app instances use same cache
- ✅ **Edge network** - <50ms global latency
- ✅ **Analytics dashboard** - Track performance and savings
- ✅ **Email support** - Get help when you need it

Perfect for:
- Production applications
- Multi-instance deployments
- Team projects
- Apps with >10K requests/month

## Installation

```bash
npm install @agentcache/standard
```

Get your API key at [agentcache.ai](https://agentcache.ai)

## Migrating from Lite

**Change one line:**

```typescript
// Before (Lite)
import { AgentCacheLite } from '@agentcache/lite';
const cache = new AgentCacheLite();

// After (Standard)
import { AgentCache } from '@agentcache/standard';
const cache = new AgentCache({ apiKey: 'ac_live_xxx' });

// API stays exactly the same! 🎉
```

## Quick Start

```typescript
import { AgentCache } from '@agentcache/standard';

const cache = new AgentCache({
  apiKey: 'ac_live_your_key_here',
  // Optional: namespace for multi-tenant
  namespace: 'customer-123',
});

// Check cache before calling LLM
const cached = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is TypeScript?' }],
});

if (cached.hit) {
  console.log('💚 Cache hit!', cached.value);
  console.log(`Age: ${cached.age}s, Latency: ${cached.latency}ms`);
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
const cache = new AgentCache({
  apiKey: string;          // Required: Your API key
  endpoint?: string;       // Optional: Custom endpoint
  namespace?: string;      // Optional: Multi-tenant namespace
  timeout?: number;        // Optional: Request timeout (ms, default: 10000)
});
```

### Methods

#### `cache.get(params)`

Check cache and retrieve response if it exists.

```typescript
const result = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...],
  temperature?: 0.7
});

// Returns:
// {
//   hit: false,              // Cache miss
//   latency: 45             // Request latency in ms
// }
// OR
// {
//   hit: true,              // Cache hit!
//   value: {...},           // Cached response
//   age: 120,               // Age in seconds
//   namespace: 'default',   // Namespace used
//   latency: 45             // Request latency in ms
// }
```

#### `cache.set(params, value, options?)`

Store response in cache.

```typescript
await cache.set(
  {
    provider: 'openai',
    model: 'gpt-4',
    messages: [...]
  },
  responseData,
  {
    ttl: 3600  // Optional: TTL in seconds (default: 7 days)
  }
);
```

#### `cache.check(params)`

Check if response is cached without retrieving it.

```typescript
const { cached, ttl } = await cache.check({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...]
});

console.log(`Cached: ${cached}, TTL: ${ttl}s`);
```

#### `cache.getStats(period?)`

Get cache performance analytics.

```typescript
const stats = await cache.getStats('7d'); // '1h', '24h', '7d', '30d'

console.log(stats);
// {
//   period: '7d',
//   metrics: {
//     total_requests: 45230,
//     cache_hits: 35400,
//     hit_rate: 78.3,
//     tokens_saved: 3540000,
//     cost_saved: '$353.40',
//     avg_latency_ms: 42
//   },
//   quota: {
//     monthly_limit: 150000,
//     monthly_used: 45230,
//     monthly_remaining: 104770,
//     usage_percent: 30.2
//   }
// }
```

## Real-World Examples

### OpenAI Integration

```typescript
import OpenAI from 'openai';
import { AgentCache } from '@agentcache/standard';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cache = new AgentCache({ apiKey: process.env.AGENTCACHE_API_KEY });

async function getChatCompletion(messages) {
  // Check cache first
  const cached = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages,
  });

  if (cached.hit) {
    console.log(`💚 Saved ~$0.03 (${cached.age}s old, ${cached.latency}ms latency)`);
    return cached.value;
  }

  // Cache miss - call OpenAI
  console.log('❌ Cache miss - calling OpenAI...');
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
import { AgentCache } from '@agentcache/standard';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const cache = new AgentCache({ apiKey: process.env.AGENTCACHE_API_KEY });

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

### Multi-Tenant SaaS

```typescript
import { AgentCache } from '@agentcache/standard';

// Create cache per customer
function getCacheForCustomer(customerId: string) {
  return new AgentCache({
    apiKey: process.env.AGENTCACHE_API_KEY,
    namespace: `customer-${customerId}`,
  });
}

// Use it
const cache = getCacheForCustomer('cust_abc123');
const result = await cache.get({...});

// Each customer gets isolated cache
// Track per-customer analytics
const stats = await cache.getStats('30d');
```

### Express API Middleware

```typescript
import express from 'express';
import { AgentCache } from '@agentcache/standard';

const app = express();
const cache = new AgentCache({ apiKey: process.env.AGENTCACHE_API_KEY });

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
      _meta: {
        cached: true,
        age: cached.age,
        latency: cached.latency,
      }
    });
  }

  // Call LLM
  const response = await callLLM(messages);
  
  // Cache for next request
  await cache.set({
    provider: 'openai',
    model: 'gpt-4',
    messages
  }, response);
  
  res.json({
    ...response,
    _meta: { cached: false }
  });
});
```

### Background Job with Monitoring

```typescript
import { AgentCache } from '@agentcache/standard';

const cache = new AgentCache({ apiKey: process.env.AGENTCACHE_API_KEY });

// Periodic stats monitoring
setInterval(async () => {
  const stats = await cache.getStats('1h');
  
  console.log(`📊 Last Hour:
    Requests: ${stats.metrics.total_requests}
    Hit Rate: ${stats.metrics.hit_rate}%
    Cost Saved: ${stats.metrics.cost_saved}
    Latency: ${stats.metrics.avg_latency_ms}ms
  `);
  
  // Alert if quota approaching limit
  if (stats.quota && stats.quota.usage_percent > 90) {
    console.warn('⚠️ Quota usage > 90% - consider upgrading');
  }
  
  // Alert if hit rate drops
  if (stats.metrics.hit_rate < 50) {
    console.warn('⚠️ Hit rate < 50% - check cache strategy');
  }
}, 3600000); // Every hour
```

## Error Handling

```typescript
import { AgentCache, AgentCacheError } from '@agentcache/standard';

try {
  const result = await cache.get({...});
} catch (error) {
  if (error instanceof AgentCacheError) {
    console.error('AgentCache error:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Details:', error.details);
    
    // Handle specific errors
    if (error.statusCode === 401) {
      console.error('Invalid API key');
    } else if (error.statusCode === 429) {
      console.error('Rate limit exceeded');
    } else if (error.statusCode === 403) {
      console.error('Quota exceeded - upgrade plan');
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Configuration Tips

### 1. **Set Appropriate TTLs**

```typescript
// FAQ bot - long TTL
await cache.set(params, response, { ttl: 86400 }); // 24 hours

// Real-time data - short TTL
await cache.set(params, response, { ttl: 300 }); // 5 minutes

// Default - medium TTL
await cache.set(params, response); // 7 days
```

### 2. **Use Namespaces for Multi-Tenancy**

```typescript
// Per-customer isolation
const customerCache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY,
  namespace: `customer-${customerId}`,
});

// Per-workflow isolation
const workflowCache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY,
  namespace: `workflow-${workflowType}`,
});
```

### 3. **Monitor Performance**

```typescript
// Daily performance report
const stats = await cache.getStats('24h');

const report = {
  hitRate: stats.metrics.hit_rate,
  costSavings: stats.metrics.cost_saved,
  efficiency: stats.performance?.efficiency_score,
  avgLatency: stats.metrics.avg_latency_ms,
};

// Send to monitoring service
await sendToDatadog(report);
```

## Pricing

| Plan | Price | Requests | Features |
|------|-------|----------|----------|
| **Indie** | $29/mo | 25K/mo | Everything included |
| **Startup** | $99/mo | 150K/mo | Priority support |
| **Growth** | $199/mo | 500K/mo | Advanced analytics |

[View detailed pricing →](https://agentcache.ai/pricing)

## Comparison

| Feature | Lite | Standard |
|---------|------|----------|
| **Storage** | In-memory | Redis (persistent) |
| **Max Entries** | 100 | Unlimited |
| **Shared Cache** | ❌ | ✅ |
| **Edge Network** | ❌ | ✅ (<50ms) |
| **Analytics** | Basic | Advanced |
| **Support** | Community | Email |
| **Price** | Free | From $29/mo |

## FAQ

**Q: Will my cache survive app restarts?**  
A: Yes! Standard uses Redis for persistence.

**Q: Can I share cache across multiple servers?**  
A: Yes! All instances with the same API key share the same cache.

**Q: What happens if AgentCache.ai is down?**  
A: Cache operations fail gracefully. Your app continues working, just without caching.

**Q: How do I migrate from Lite?**  
A: Change one line - the constructor. API is 100% compatible.

**Q: Can I use demo keys?**  
A: Yes! Use `ac_demo_test123` for testing (no signup required).

**Q: Do you support streaming?**  
A: Cache the final concatenated response after streaming completes.

## TypeScript Support

Fully typed with excellent IntelliSense support:

```typescript
import { AgentCache, CacheParams, GetResult } from '@agentcache/standard';

// Typed parameters
const params: CacheParams = {
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
};

// Typed response
const result: GetResult<OpenAI.ChatCompletion> = await cache.get(params);
```

## Contributing

Found a bug? Have a feature request?  
[Open an issue](https://github.com/jettythunder/agentcache-ai/issues)

## License

MIT © JettyThunder Labs

## Links

- 🌐 [Website](https://agentcache.ai)
- 📖 [Documentation](https://agentcache.ai/docs)
- 💬 [Discord](https://discord.gg/agentcache)
- 🐦 [Twitter](https://twitter.com/agentcache)
- 📊 [Dashboard](https://agentcache.ai/dashboard)

---

**Built by [JettyThunder Labs](https://jettythunder.app)**  
*Helping developers save thousands on AI costs*
