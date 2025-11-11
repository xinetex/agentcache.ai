# Social Media Launch Posts

## Twitter/X Thread (Developer-focused)

### Tweet 1 (Hook)
```
I just shipped AgentCache.ai - an edge caching layer for AI API calls.

Cut my AI costs by 90% and made responses 10x faster.

It's just 5 lines of code. Here's how it works 🧵
```

### Tweet 2 (Problem)
```
The problem: Every identical AI prompt costs you money and time.

If 100 users ask "What is Python?" you're paying OpenAI 100 times for the same answer.

That's $$$$ wasted on duplicate LLM calls.
```

### Tweet 3 (Solution)
```
AgentCache sits between your app and OpenAI/Anthropic/Claude.

First call? Cache miss → calls LLM → stores response
Next 99 calls? Cache hit → instant response from edge

Same quality. 10x faster. 90% cheaper.
```

### Tweet 4 (Code example)
```
// Before
const response = await openai.chat.completions.create({...});

// After  
import { AgentCache } from 'agentcache-client';
const cache = new AgentCache('your_api_key');

const result = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...]
});

if (result.hit) return result.response; // ⚡️ instant

// Cache miss - call LLM
const response = await openai.chat.completions.create({...});
await cache.set({...}); // Store for next time
```

### Tweet 5 (Moonshot feature)
```
Special feature: Moonshot AI (Kimi K2) integration

Caches reasoning tokens separately from responses
→ 98% cost savings on complex analysis
→ 200K+ token context windows
→ Perfect for codebase analysis

Example: $405/mo → $8.10/mo
```

### Tweet 6 (Proof/Metrics)
```
Real metrics from our dashboard:
• Hit rate: 72% (week 1)
• P95 latency: <50ms
• Global edge via Upstash Redis
• Deterministic SHA-256 cache keys

Open beta, free tier available.
```

### Tweet 7 (CTA)
```
Try it now:
npm install agentcache-client

Or test with cURL:
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_demo_test123" \
  -d '{...}'

Docs: agentcache.ai
GitHub: github.com/xinetex/agentcache.ai

Built in public. Shipping fast. 🚀
```

---

## LinkedIn Post (Professional/Technical)

```
🚀 Launched: AgentCache.ai - Edge Caching for AI API Calls

After analyzing our AI spend, I realized we were paying for the same LLM responses hundreds of times per day.

So I built AgentCache - an edge caching layer that sits between your application and AI providers (OpenAI, Anthropic, Claude, Moonshot AI).

**How it works:**
1. Deterministic cache keys (SHA-256 hash of prompt + model + params)
2. First call goes to your LLM provider
3. Response cached at the edge with configurable TTL
4. Subsequent identical prompts return instantly from cache

**Results:**
• 90% cost reduction on duplicate calls
• 10x faster response times (sub-50ms P95)
• Works with any LLM provider
• Drop-in NPM package or REST API

**Unique feature: Moonshot AI (Kimi K2) reasoning token caching**
We're the first caching service to cache reasoning tokens separately from responses. This enables 98% cost savings on complex analytical queries with 200K+ token context windows.

**Use cases:**
- Agent platforms with repetitive queries
- Customer support bots with FAQ patterns
- Documentation search
- Codebase analysis
- Multi-tenant AI applications

Currently in open beta. NPM package published, real-time analytics dashboard live, and transparent public roadmap.

npm install agentcache-client

Tech stack: Vercel Edge Functions, Upstash Redis, TypeScript
License: MIT

Would love feedback from anyone building with LLMs. What features would make this more useful for your use case?

#AI #LLM #EdgeComputing #OpenSource #DevTools
```

---

## Reddit Post (r/programming, r/MachineLearning, r/webdev)

### Title
```
[Project] AgentCache.ai - I built an edge cache for AI API calls to cut costs by 90%
```

### Body
```
Hey folks, I've been working on a side project and just shipped the MVP.

**TL;DR:** Edge caching layer for AI API calls. Reduces costs by 90% and makes responses 10x faster. Open beta now.

## The Problem

If you're building with OpenAI/Anthropic/Claude, you've probably noticed:
1. The same prompts get asked over and over
2. Each call costs money and takes 2-5 seconds
3. Your AI bill grows linearly with users

I was spending $400+/month on duplicate LLM calls.

## The Solution

AgentCache sits between your app and your LLM provider. It generates deterministic cache keys (SHA-256 hash) based on:
- Provider (openai, anthropic, etc.)
- Model (gpt-4, claude-3, etc.)
- Messages/prompts
- Temperature and other params

First call? Cache miss → calls your LLM → stores response at edge
Next calls? Cache hit → instant response (sub-50ms)

## Tech Stack

- **Backend:** Vercel Edge Functions (globally distributed)
- **Cache:** Upstash Redis (multi-region edge KV)
- **SDK:** TypeScript NPM package + REST API
- **Integrations:** OpenAI, Anthropic, Claude, Moonshot AI

## What's Live

✅ NPM package: `npm install agentcache-client`
✅ REST API with demo keys
✅ Moonshot AI (Kimi K2) with reasoning token caching
✅ Real-time analytics dashboard
✅ Namespace support for multi-tenancy
✅ Webhooks for quota alerts
✅ Rate limiting and monthly quotas

## Unique Feature: Reasoning Token Caching

We're the first service to cache Moonshot AI's reasoning tokens separately from responses. This is huge for complex analysis:

**Example:** 100K token codebase analysis
- Without caching: $405/month (50 queries/day)
- With AgentCache: $8.10/month (98% savings)

The "thinking" process gets cached independently with a shorter TTL (1 hour) while the response gets cached longer (7 days).

## Quick Start

```javascript
import { AgentCache } from 'agentcache-client';
const cache = new AgentCache('ac_demo_test123'); // Demo key

const result = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Explain caching' }]
});

if (result.hit) {
  console.log('Cache hit!', result.latency_ms + 'ms');
  return result.response;
}

// Cache miss - call your LLM and store
const llmResponse = await openai.chat.completions.create({...});
await cache.set({...});
```

## Transparent Roadmap

I'm building in public with a transparent roadmap on the landing page:
- **Q1 2025:** Streaming support, tag-based purging, Stripe billing (at 50 users)
- **Q2 2025:** PII scrubbing, self-hosted option, Python/Go SDKs

## Try It

- Website: https://agentcache.ai
- GitHub: https://github.com/xinetex/agentcache.ai
- Docs: https://agentcache.ai/docs.html
- NPM: `npm install agentcache-client`

Free tier available. Open to feedback!

## Questions I'm expecting:

**Q: What about stale data?**
A: TTLs are configurable per request (default 7 days). Tag-based purging coming Q1.

**Q: Security?**
A: All data encrypted at rest by Upstash (TLS in transit, AES-256 at rest). PII scrubbing coming Q2.

**Q: Why not just use Redis?**
A: You could! But you'd need to:
- Implement deterministic key generation
- Handle edge distribution
- Build analytics
- Set up webhooks
- Manage quotas and rate limiting

AgentCache does all this out of the box.

Would love to hear what you think!
```

---

## Hacker News (Show HN)

### Title
```
Show HN: AgentCache.ai – Edge caching for AI API calls (90% cost reduction)
```

### Body
```
Hey HN! I'm the co-creator of AgentCache.ai - an edge caching layer for AI API calls.

**What it does:** Sits between your app and OpenAI/Anthropic/Claude, caches responses at the edge, and returns duplicate queries instantly.

**Why it exists:** I was paying $400+/month for the same LLM responses over and over. Built this to solve my own problem.

**Tech:**
- Vercel Edge Functions (global distribution)
- Upstash Redis (edge KV store)
- SHA-256 deterministic keys
- TypeScript SDK + REST API

**What's different:**
1. First service with Moonshot AI reasoning token caching (98% savings on complex queries)
2. Transparent roadmap - features marked "Live Now" vs "Q1 2025" on landing page
3. Built in public, MIT license

**Try it:**
```bash
npm install agentcache-client
```

Demo key: `ac_demo_test123`
Site: https://agentcache.ai
GitHub: https://github.com/xinetex/agentcache.ai

Open to feedback. What features would make this more useful?
```

---

## Dev.to / Hashnode Blog Post

### Title
```
I Built an Edge Cache for AI API Calls and Cut Costs by 90%
```

### Excerpt
```
How I used Vercel Edge Functions and Upstash Redis to build AgentCache.ai - a caching layer that makes AI responses 10x faster and 90% cheaper. Open beta, MIT license, NPM package published.
```

### Tags
```
#ai #llm #edge #caching #openai #typescript #vercel #redis
```

### Content
[See full blog post format - can expand if needed]

---

## Key Messaging Points

✅ **Technical credibility**: SHA-256 hashing, deterministic keys, edge distribution
✅ **Real metrics**: 90% cost reduction, 10x faster, sub-50ms P95
✅ **Honest marketing**: Clear about what's live vs coming soon
✅ **Open source**: MIT license, GitHub public
✅ **Built in public**: Transparent roadmap, real dashboard
✅ **Unique feature**: Moonshot AI reasoning token caching (first to market)

## Hashtags

**Twitter/X:**
#AI #LLM #EdgeComputing #DevTools #OpenSource #TypeScript

**LinkedIn:**
#ArtificialIntelligence #MachineLearning #SoftwareDevelopment #DevTools #CloudComputing

**Dev Communities:**
ai, llm, caching, performance-optimization, cost-reduction
