# AgentCache.ai

**Edge caching service for AI responses - Save 90% on LLM costs**

AgentCache.ai is a transparent caching layer for AI/LLM API calls. Cache responses from OpenAI, Anthropic, Moonshot, and other providers to dramatically reduce costs and improve latency.

## 🚀 Features

- **90% Cost Savings**: Cache identical prompts and reuse responses
- **10x Faster**: <50ms cache hit latency vs 2-5s LLM API calls
- **Drop-in Integration**: Works with any LLM provider
- **Smart Deduplication**: Semantic similarity matching (coming soon)
- **Usage Analytics**: Track savings, hit rates, and performance
- **Multi-Provider**: OpenAI, Anthropic, Moonshot, Cohere, Together.ai, Groq

## 💰 Pricing

### Free Tier
- **$0/month**
- 1,000 requests/month
- 7-day cache TTL
- Basic analytics
- Community support

### Starter Plan
- **$9/month** (or $90/year - save 16%)
- 10,000 requests/month
- 30-day cache TTL
- Advanced analytics
- Email support

### Pro Plan
- **$29/month** (or $290/year - save 16%)
- 100,000 requests/month
- 90-day cache TTL
- Real-time analytics dashboard
- Priority support
- Custom cache rules

### Enterprise Plan
- **$199/month** (or $1,990/year - save 16%)
- Unlimited requests
- Custom TTL
- Dedicated Redis instance
- White-label option
- SLA guarantee
- Slack support

## 📦 Installation

```bash
npm install agentcache-client
# or
yarn add agentcache-client
# or
pnpm add agentcache-client
```

## 🔑 Get API Key

1. Sign up at [agentcache.ai](https://agentcache.ai)
2. Create an API key in your dashboard
3. Copy your key: `ac_live_xxxxx...`

## 📝 Usage

### OpenAI Example

```typescript
import OpenAI from 'openai';
import { AgentCache } from 'agentcache-client';

const cache = new AgentCache('ac_live_YOUR_KEY');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function chat(messages: Array<{ role: string; content: string }>) {
  // Try cache first
  const cached = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages,
  });
  
  if (cached) {
    console.log('💚 Cache hit! Saved $0.05');
    return cached.response;
  }
  
  // Cache miss - call OpenAI
  console.log('💸 Cache miss - calling OpenAI...');
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
  });
  
  const text = response.choices[0].message.content;
  
  // Store in cache for next time
  await cache.set({
    provider: 'openai',
    model: 'gpt-4',
    messages,
    response: text,
  });
  
  return text;
}

// Usage
const answer = await chat([
  { role: 'user', content: 'What is the capital of France?' }
]);
console.log(answer);
```

### Anthropic Example

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AgentCache } from 'agentcache-client';

const cache = new AgentCache('ac_live_YOUR_KEY');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function chat(messages: Array<{ role: string; content: string }>) {
  const cached = await cache.get({
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    messages,
  });
  
  if (cached) return cached.response;
  
  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
    messages,
  });
  
  const text = response.content[0].text;
  
  await cache.set({
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    messages,
    response: text,
  });
  
  return text;
}
```

## 📊 Analytics

Track your cost savings and performance:

```typescript
const stats = await cache.getStats();
console.log(stats);
// {
//   plan: 'pro',
//   monthlyQuota: 100000,
//   used: 45231,
//   remaining: 54769,
//   cacheHitRate: 87.5,
//   estimatedSavings: '$342.40',
//   topProvider: 'openai'
// }
```

## 🔧 API Reference

### `cache.get(options)`
Check cache for existing response.

**Options:**
- `provider`: `'openai' | 'anthropic' | 'moonshot' | 'cohere' | 'together' | 'groq'`
- `model`: Model identifier (e.g., `'gpt-4'`, `'claude-3-opus'`)
- `messages`: Array of message objects
- `temperature`: (optional) Temperature parameter

**Returns:** `{ hit: boolean, response?: string, latency: number }`

### `cache.set(options)`
Store AI response in cache.

**Options:**
- All options from `get()`
- `response`: AI response text to cache
- `ttl`: (optional) Time to live in seconds (default: 7 days)

**Returns:** `{ success: boolean, key: string }`

### `cache.getStats()`
Retrieve usage statistics.

**Returns:** Usage analytics object

## 🌍 Self-Hosting

AgentCache.ai can be self-hosted:

```bash
git clone https://github.com/jettythunder/agentcache-ai.git
cd agentcache-ai
cp .env.example .env
# Edit .env with your Redis URL
pnpm install
pnpm dev
```

## 📄 License

MIT License - See LICENSE file

## 🤝 Support

- **Email**: support@agentcache.ai
- **Discord**: [discord.gg/agentcache](https://discord.gg/agentcache)
- **Docs**: [agentcache.ai/docs](https://agentcache.ai/docs)

## 🎯 ROI Calculator

**Without AgentCache.ai:**
- 100K GPT-4 calls/month
- Average cost: $0.03/call
- **Monthly cost: $3,000**

**With AgentCache.ai (85% hit rate):**
- 15K uncached calls: $450
- 85K cached calls: $0
- AgentCache.ai Pro: $29
- **Monthly cost: $479**
- **Savings: $2,521/month** 💰

---

Built with ❤️ by [JettyThunder Labs](https://jettythunder.app)
