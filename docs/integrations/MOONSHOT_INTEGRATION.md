# Moonshot AI (Kimi K2) Integration

AgentCache.ai now supports **Moonshot AI's Kimi K2** with advanced reasoning token caching.

## Why Kimi K2?

- **200K+ token context window** (vs GPT-4's 128K)
- **Exposed reasoning tokens** (visible "thinking" process)
- **Cost-effective** (~80% cheaper than GPT-4 for Chinese/English)
- **Deep reasoning** (similar to o1 but more transparent)

## Setup

### 1. Get Moonshot API Key

Sign up at [https://platform.moonshot.ai](https://platform.moonshot.ai) and generate an API key.

Organization: `org-f51c4e3d88d545a3a94744188e08d555`

### 2. Configure Environment

Add to your `.env` (or Vercel environment variables):

```bash
MOONSHOT_API_KEY=sk-...
MOONSHOT_ORG_ID=org-f51c4e3d88d545a3a94744188e08d555
```

### 3. Deploy

Push to GitHub to trigger Vercel deployment:

```bash
git add .
git commit -m "Add Moonshot AI integration"
git push origin main
```

## Usage

### Basic Request

```bash
curl -X POST https://agentcache.ai/api/moonshot \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "moonshot-v1-128k",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain quantum computing in detail"}
    ],
    "temperature": 0.7,
    "cache_reasoning": true
  }'
```

### Response Format

**Cache Hit:**
```json
{
  "hit": true,
  "response": "Quantum computing is...",
  "reasoning": {
    "tokens": 5000,
    "cost_saved": "$0.1500",
    "cached": true
  },
  "cached_at": "2025-01-11T10:30:00Z",
  "latency_ms": 1
}
```

**Cache Miss:**
```json
{
  "hit": false,
  "response": "Quantum computing is...",
  "reasoning": {
    "tokens": 5000,
    "cost_saved": "$0.1500",
    "cached": false
  },
  "latency_ms": 850,
  "cached": true
}
```

## Reasoning Token Caching

Kimi K2 exposes its "thinking" process via reasoning tokens. AgentCache caches these separately:

- **Response cache**: 7 days TTL
- **Reasoning cache**: 1 hour TTL (more volatile)

### Benefits

For a typical reasoning-heavy query:
- **Without caching**: 150K context + 5K reasoning + 2K response = $4.71
- **With AgentCache**: 2K response tokens only = $0.06
- **Savings**: 98.7% per cached call

### Events

The Moonshot endpoint triggers special webhook events:

- `reasoning.cached` - When reasoning tokens are cached
- `reasoning.reused` - When cached reasoning is reused
- `cache.hit` / `cache.miss` - Standard cache events

## Namespace Support

Use namespaces to isolate caching by customer/workflow:

```bash
curl -X POST https://agentcache.ai/api/moonshot \
  -H "X-API-Key: ac_live_xxx" \
  -H "X-Cache-Namespace: customer_abc" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Models

Available Kimi models:

- `moonshot-v1-8k` - 8K context
- `moonshot-v1-32k` - 32K context
- `moonshot-v1-128k` - 128K context (recommended)

## Cost Comparison

| Provider | Model | Input | Output | Reasoning |
|----------|-------|-------|--------|-----------|
| OpenAI | GPT-4 Turbo | $10/1M | $30/1M | N/A |
| OpenAI | o1 | $15/1M | $60/1M | $60/1M |
| Moonshot | Kimi K2 | $1.2/1M | $1.2/1M | $0.03/1K* |

*Estimated reasoning token cost

## Integration with JettyThunder

JettyThunder can receive reasoning events via webhooks:

```typescript
// Webhook handler at /api/webhooks/agentcache/route.ts
async function handleReasoningReused(data: any) {
  console.log(`[AgentCache] Reasoning reused: ${data.tokens_saved} tokens saved`);
  
  // Update dashboard metrics
  await updateDashboard({
    reasoning_hits: increment(1),
    reasoning_tokens_saved: increment(data.tokens_saved)
  });
}
```

## Example: Long-Context Caching

For a codebase analysis agent:

```typescript
// First call - caches 150K token codebase + reasoning
const result1 = await fetch('https://agentcache.ai/api/moonshot', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.AGENTCACHE_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'moonshot-v1-128k',
    messages: [
      { role: 'system', content: ENTIRE_CODEBASE }, // 150K tokens
      { role: 'user', content: 'Find authentication vulnerabilities' }
    ],
    cache_reasoning: true
  })
});

// Subsequent calls - instant from cache
const result2 = await fetch('https://agentcache.ai/api/moonshot', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.AGENTCACHE_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'moonshot-v1-128k',
    messages: [
      { role: 'system', content: ENTIRE_CODEBASE },
      { role: 'user', content: 'Find authentication vulnerabilities' } // Same query
    ],
    cache_reasoning: true
  })
});

// result2 returns instantly with:
// - hit: true
// - latency_ms: 1
// - cost: $0.00 (vs $4.71 without caching)
```

## Disable Reasoning Caching

If you only want to cache final responses:

```json
{
  "model": "moonshot-v1-128k",
  "messages": [...],
  "cache_reasoning": false
}
```

## Monitoring

Check your reasoning cache stats:

```bash
curl https://agentcache.ai/api/stats \
  -H "X-API-Key: ac_live_xxx"
```

Response includes reasoning metrics (coming in Phase 2):

```json
{
  "metrics": {
    "total_requests": 1000,
    "cache_hits": 800,
    "hit_rate": 80.0,
    "reasoning_hits": 450,
    "reasoning_tokens_saved": 2250000,
    "reasoning_cost_saved": "$67.50"
  }
}
```

## Troubleshooting

### Error: Moonshot API key not configured

Add `MOONSHOT_API_KEY` to your Vercel environment variables:

```bash
vercel env add MOONSHOT_API_KEY
# Enter your key: sk-...
```

### Error: Invalid model

Supported models:
- `moonshot-v1-8k`
- `moonshot-v1-32k`
- `moonshot-v1-128k`

### Reasoning tokens not appearing

Not all Moonshot models expose reasoning tokens. Use `moonshot-v1-128k` for best results.

## Next Steps

1. **Add reasoning metrics to stats API** (Phase 2)
2. **Dashboard visualization** (Phase 2)
3. **Automatic reasoning vs. response optimization** (Phase 3)

## Learn More

- [Moonshot AI Platform](https://platform.moonshot.ai)
- [AgentCache Webhook Guide](./WEBHOOKS_AND_KIMI_GUIDE.md)
- [JettyThunder Integration](./JETTYTHUNDER_INTEGRATION.md)
