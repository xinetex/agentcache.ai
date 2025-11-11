# Moonshot AI Quick Start

Get Kimi K2 reasoning token caching up and running in 5 minutes.

## Prerequisites

- AgentCache.ai account with API key
- Moonshot AI account (org: `org-f51c4e3d88d545a3a94744188e08d555`)
- Vercel account (for deployment)

## Step 1: Add Moonshot API Key to Vercel

```bash
# Navigate to agentcache-ai directory
cd /Users/letstaco/Documents/agentcache-ai

# Add Moonshot key to Vercel environment
vercel env add MOONSHOT_API_KEY production
# Paste your Moonshot API key when prompted

vercel env add MOONSHOT_ORG_ID production
# Paste: org-f51c4e3d88d545a3a94744188e08d555
```

Or add via Vercel dashboard:
1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add `MOONSHOT_API_KEY` = `sk-...`
3. Add `MOONSHOT_ORG_ID` = `org-f51c4e3d88d545a3a94744188e08d555`

## Step 2: Deploy to Production

```bash
# Commit and push (triggers auto-deploy)
git add .
git commit -m "Add Moonshot AI integration with reasoning token caching"
git push origin main
```

Wait ~2 minutes for deployment to complete.

## Step 3: Test the Integration

```bash
# Test with demo key
curl -X POST https://agentcache.ai/api/moonshot \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "moonshot-v1-128k",
    "messages": [
      {"role": "user", "content": "Explain quantum entanglement"}
    ],
    "cache_reasoning": true
  }'
```

**Expected response (first call - cache miss):**
```json
{
  "hit": false,
  "response": "Quantum entanglement is...",
  "reasoning": {
    "tokens": 3500,
    "cost_saved": "$0.1050",
    "cached": false
  },
  "latency_ms": 850,
  "cached": true
}
```

**Run the same command again (cache hit):**
```json
{
  "hit": true,
  "response": "Quantum entanglement is...",
  "reasoning": {
    "tokens": 3500,
    "cost_saved": "$0.1050",
    "cached": true
  },
  "cached_at": "2025-01-11T11:00:00Z",
  "latency_ms": 1
}
```

## Step 4: Register Webhook (Optional)

Get real-time notifications for reasoning events:

```bash
# Replace YOUR_API_KEY with your AgentCache API key
curl -X POST https://agentcache.ai/api/webhooks \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://jettythunder.app/api/webhooks/agentcache",
    "events": [
      "reasoning.cached",
      "reasoning.reused",
      "quota.warning",
      "quota.exceeded"
    ],
    "secret": "YOUR_WEBHOOK_SECRET"
  }'
```

## Step 5: Monitor Usage

```bash
curl https://agentcache.ai/api/stats?period=24h \
  -H "X-API-Key: YOUR_API_KEY"
```

## Usage in JettyThunder

### TypeScript/JavaScript

```typescript
// In your JettyThunder agent code
async function queryWithReasoningCache(prompt: string) {
  const response = await fetch('https://agentcache.ai/api/moonshot', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.AGENTCACHE_API_KEY!,
      'X-Cache-Namespace': 'jettythunder', // Isolate cache
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'moonshot-v1-128k',
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      cache_reasoning: true // Enable reasoning cache
    })
  });

  const data = await response.json();
  
  if (data.hit) {
    console.log(`✅ Cache hit! Latency: ${data.latency_ms}ms`);
  } else {
    console.log(`❌ Cache miss. Latency: ${data.latency_ms}ms`);
  }
  
  if (data.reasoning) {
    console.log(`💡 Reasoning: ${data.reasoning.tokens} tokens, saved ${data.reasoning.cost_saved}`);
  }
  
  return data.response;
}

// Example usage
const answer = await queryWithReasoningCache('Explain the theory of relativity');
console.log(answer);
```

## Cost Savings Example

**Scenario**: Agent analyzes a 100K token codebase 50 times per day

**Without AgentCache**:
- 50 calls × 100K tokens × $0.0012/1K = $6.00/day
- Monthly cost: $180

**With AgentCache** (80% hit rate):
- First call: $0.12 (cached for 7 days)
- Next 49 calls: $0.00 (from cache)
- Monthly cost: ~$3.60 (98% savings)

**With Reasoning Cache** (additional 20% savings on reasoning tokens):
- Reasoning tokens: ~5K per call
- Without cache: 50 × 5K × $0.00003 = $7.50/day
- With cache: First call only = $0.15/day (98% savings)

**Total savings**: $176.40/month → $356.40/month at scale

## Troubleshooting

### Error: Moonshot API key not configured

Check Vercel environment variables:
```bash
vercel env ls
```

If missing, add them:
```bash
vercel env add MOONSHOT_API_KEY production
vercel env add MOONSHOT_ORG_ID production
```

Then redeploy:
```bash
vercel --prod
```

### Error: Invalid API key format

AgentCache API keys must start with `ac_`:
- Demo keys: `ac_demo_*`
- Live keys: `ac_live_*`

Get your key from AgentCache.ai dashboard.

### Reasoning tokens not appearing

Some Moonshot models don't expose reasoning tokens. Use `moonshot-v1-128k` for best results.

### Webhook not receiving events

1. Check webhook is registered:
   ```bash
   curl https://agentcache.ai/api/webhooks \
     -H "X-API-Key: YOUR_API_KEY"
   ```

2. Test webhook delivery:
   ```bash
   curl -X POST https://agentcache.ai/api/webhooks/test \
     -H "X-API-Key: YOUR_API_KEY"
   ```

3. Check JettyThunder logs:
   ```bash
   vercel logs --follow
   # Look for: [AgentCache] Test webhook received successfully
   ```

## Next Steps

- [ ] Set up JettyThunder dashboard to display reasoning metrics
- [ ] Configure Slack notifications for high-value reasoning cache hits
- [ ] Implement automatic reasoning vs. response cache optimization
- [ ] Add namespace-specific analytics

## Documentation

- [Full Moonshot Integration Guide](./MOONSHOT_INTEGRATION.md)
- [Webhook Guide](./WEBHOOKS_AND_KIMI_GUIDE.md)
- [JettyThunder Integration](./JETTYTHUNDER_INTEGRATION.md)
- [WARP.md](./WARP.md)
