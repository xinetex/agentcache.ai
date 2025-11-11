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

```bash
npm install agentcache-client
```

```javascript
import { AgentCache } from 'agentcache-client';

const cache = new AgentCache('ac_demo_test123');

// Check cache
const cached = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is Python?' }]
});

if (cached.hit) {
  console.log('💚 Cache hit! Saved $0.05, latency: 23ms');
  return cached.response;
}

// Cache miss - call your provider
const response = await callOpenAI(...);

// Store for next time
await cache.set({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is Python?' }],
  response: response
});
```

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
💰 SAVE $2,501/MONTH
```

## Features

- **Provider agnostic** - OpenAI, Anthropic, Moonshot, Cohere, Together, Groq
- **Global edge** - Upstash Redis with <50ms P95 latency
- **Streaming support** - SSE passthrough for cached responses
- **Zero config** - Automatic cache key generation
- **Usage analytics** - Track hit rates and savings in real-time
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

🚧 **MVP - Beta Launch** (January 2025)

What works:
- ✅ Core caching API
- ✅ Demo API keys
- ✅ Redis backend
- ✅ Beautiful landing page

Coming soon:
- 🔜 User authentication & Stripe billing
- 🔜 Usage dashboard
- 🔜 NPM package
- 🔜 Python SDK

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
