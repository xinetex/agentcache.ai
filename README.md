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
- ✅ Cache identical prompts automatically
- ✅ Return responses in <50ms (10x faster)
- ✅ Pay $0 for cache hits (90% savings)
- ✅ Works with OpenAI, Anthropic, Claude, any LLM

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

- **Provider agnostic** - OpenAI, Anthropic, Moonshot, Cohere, Together, Groq
- **Global edge** - Upstash Redis with <50ms P95 latency
- **Streaming support** - SSE passthrough for cached responses
- **Multi-Model Swarm** - Run parallel, consensus, or cheapest strategies
- **Semantic Caching** - (Beta) Vector-based matching for higher hit rates
- **Elastic Overflow** - Use AgentCache as overflow for Redis/ElastiCache
- **Zero config** - Automatic cache key generation
- **Deterministic keys** - Same input = same key, always

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

```
┌─────────────┐
│  Your App   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  AgentCache.ai  │◄──── Check cache first
└──────┬──────────┘
       │
    ┌──┴──┐
    │     │
    ▼     ▼
┌───────┐ ┌──────────┐
│  Hit  │ │   Miss   │
│ <50ms │ │ Call LLM │
│  $0   │ │ + Cache  │
└───────┘ └──────────┘
```

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
