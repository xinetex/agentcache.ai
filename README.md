# AgentCache.ai

**Edge caching for AI API calls. 10x faster, 90% cheaper.**

Stop paying for the same AI response twice. Drop in 5 lines of code and save thousands per month.

🚀 **[Get started free](https://agentcache.ai)** • 📖 **[Read docs](https://agentcache.ai/docs)** • 💬 **[Join Discord](https://discord.gg/agentcache)**

---

## The Problem

Companies waste thousands monthly on duplicate AI API calls:
- Same questions asked repeatedly = full price every time
- 2-5 second latencies on every call
- No way to track or optimize spending

## The Solution

AgentCache sits between your app and AI providers:
- ✅ **Multi-tier caching** (L1/L2/L3) - Session, Redis, and Semantic layers
- ✅ **Return responses in <5ms** (L1) to <200ms (L3)
- ✅ **Pay $0 for cache hits** (90% cost savings)
- ✅ **Works with any provider** - OpenAI, Anthropic, Claude, Groq, Together
- ✅ **Cache everything** - LLM calls, tool results, database queries
- ✅ **Semantic search** - Find similar queries with vector embeddings

## Quick Start

**Demo API key for testing:** `ac_demo_test123`

### Python SDK

```bash
pip install agentcache
```

```python
import agentcache

# Drop-in replacement for OpenAI
response = agentcache.completion(
    model="gpt-4",
    messages=[{"role": "user", "content": "What is Python?"}],
    provider="openai"
)

if response.get('hit'):
    print(f"💚 Cache hit! Saved ${response.get('billing', {}).get('cost_saved', 0)}")
    print(response['response'])
else:
    print("Cache miss - call your LLM provider normally")

## Caching Strategies

AgentCache supports three powerful caching strategies:

### 1. Standard Cache (Default)
Fast key-value caching for identical prompts:
```python
response = agentcache.completion(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello"}]
)
```

### 2. Reasoning Cache
**NEW** - Neuro-symbolic caching for reasoning models (o1, Kimi, DeepSeek):
```python
response = agentcache.completion(
    model="o1-preview",
    messages=[{"role": "user", "content": "Analyze this legal contract..."}],
    strategy="reasoning_cache"
)
# Caches reasoning traces, not just final outputs
```

### 3. Multimodal Cache
**NEW** - Cache generative assets (3D meshes, images, audio):
```python
response = agentcache.completion(
    model="sam-3d-body",
    messages=[{
        "role": "user",
        "content": "Generate 3D model",
        "file_path": "input_image.jpg"
    }],
    strategy="multimodal"
)
# Save 99% on GPU compute for repeated requests
```

### REST API

```bash
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

## Features

### Core Caching
- **3-Tier Architecture** - L1 (session), L2 (Redis), L3 (vector semantic search)
- **Provider agnostic** - OpenAI, Anthropic, Moonshot, Cohere, Together, Groq
- **Global edge** - Upstash Redis with <50ms P95 latency
- **Streaming support** - SSE passthrough for cached responses
- **Zero config** - Automatic cache key generation
- **Deterministic keys** - Same input = same key, always

### Advanced Features
- **Semantic Caching** - Vector-based similarity matching (95%+ threshold)
- **Tool Caching** - Cache function/API call results
- **Database Caching** - Cache query results with schema versioning
- **Multi-Model Swarm** - Run parallel, consensus, or cheapest strategies
- **Cache Invalidation** - Pattern-based, tag-based, or namespace-wide
- **Elastic Overflow** - Use AgentCache as overflow for Redis/ElastiCache

### Observability
- **Multi-tier analytics** - Hit rates, latency, and costs by tier
- **Real-time metrics** - ROI tracking, cost savings, efficiency scores
- **Trace integration** - Full observability of cache operations

## Pricing

| Plan | Price | Requests | Best For |
|------|-------|----------|----------|
| **Free** | $0 | 1K/mo | Testing |
| **Starter** | $19/mo | 25K/mo | Side projects |
| **Pro** | $49/mo | 150K/mo | Startups ⭐ |
| **Business** | $149/mo | 500K/mo | Scale-ups |

💡 **Pro tip**: At 85% hit rate, Pro plan saves you **$2,500/month** while costing $49

[View detailed pricing →](https://agentcache.ai/#pricing)

## Use Cases

### 1. ChatGPT Clone
Cache common questions across all users
```
"What is Python?" × 500 users = 499 cache hits = $14.50 saved
```

### 2. AI Code Assistant  
Cache code explanations
```
"Explain React hooks" = cache once, instant for everyone
```

### 3. Documentation Bot
Cache FAQ answers
```
Same API question asked 1000x = $30 → $0.03
```

## Performance

| Metric | Value |
|--------|-------|
| Cache hit latency | <50ms P95 |
| Cache miss overhead | <5ms |
| Hit rate (typical) | 70-90% |
| Cost savings | Up to 90% |
| Global regions | 20+ |

## Current Status

🚧 **MVP - Production Ready** (January 2025)

What works:
- ✅ Core caching API (Get, Set, Check)
- ✅ Streaming Support (SSE)
- ✅ Python SDK
- ✅ Multi-Model Swarm & Observability
- ✅ Elastic Overflow Service
- ✅ Semantic Caching (Strategy defined)
- ✅ Redis backend
- ✅ Beautiful landing page

Coming soon:
- 🔜 User authentication & Stripe billing
- 🔜 Usage dashboard
- 🔜 Go SDK
- 🔜 Self-hosted option

## Architecture

### Multi-Tier Caching System

```
User Query
    ↓
┌─────────────────────────┐
│  L1: Session Cache      │  <5ms    | $0 (Free)
│  (In-Memory)            │
└────────┬────────────────┘
         │ MISS
         ▼
┌─────────────────────────┐
│  L2: Redis Cache        │  20-50ms | $0.0001/req
│  (Global Edge)          │
└────────┬────────────────┘
         │ MISS
         ▼
┌─────────────────────────┐
│  L3: Semantic Cache     │  100-200ms | $0.001/req
│  (Vector Search)        │
└────────┬────────────────┘
         │ MISS
         ▼
┌─────────────────────────┐
│  LLM Provider           │  3-8s    | $0.01-0.30/req
│  (OpenAI, Anthropic)    │
└─────────────────────────┘
```

**Hit Distribution:**
- L1 (Session): 40% of requests - Instant, $0
- L2 (Redis): 35% of requests - Fast, $0.0001
- L3 (Semantic): 17% of requests - Good, $0.001
- LLM Miss: 8% of requests - Slow, $0.02+

## Tech Stack

- **Backend**: Node.js + Hono (edge-compatible)
- **Cache**: Upstash Redis (global)
- **Deploy**: Vercel Edge Functions
- **Frontend**: TailwindCSS + Lucide icons

## Roadmap

**Q1 2025 - MVP**
- [x] Landing page
- [x] Caching API
- [x] Demo keys
- [ ] User auth
- [ ] Stripe integration
- [ ] NPM package

**Q2 2025 - Growth**
- [ ] Python SDK
- [ ] Go SDK
- [ ] Usage dashboard
- [ ] Webhook notifications
- [ ] Team management

**Q3 2025 - Scale**
- [ ] Self-hosted option
- [ ] Enterprise features
- [ ] Custom regions
- [ ] SLA guarantees

## Contributing

Want to help? We need:
- SDK contributors (Python, Go, Ruby)
- Documentation writers
- Integration examples
- Bug reports & feature requests

## License

MIT License - See [LICENSE](LICENSE)

## Links

- 🌐 **Website**: [agentcache.ai](https://agentcache.ai)
- 📖 **Docs**: [agentcache.ai/docs](https://agentcache.ai/docs)  
- 🐦 **Twitter**: [@agentcache](https://twitter.com/agentcache)
- 💬 **Discord**: [Join community](https://discord.gg/agentcache)
- 📧 **Email**: support@agentcache.ai

## Support

- **Issues**: [GitHub Issues](https://github.com/jettythunder/agentcache-ai/issues)
- **Email**: support@agentcache.ai
- **Enterprise**: sales@agentcache.ai

---

<div align="center">

**Built by [JettyThunder Labs](https://jettythunder.app)**

*Helping developers save thousands on AI costs*

[Start saving today →](https://agentcache.ai)

</div>
Tue Nov 25 14:40:51 EST 2025
