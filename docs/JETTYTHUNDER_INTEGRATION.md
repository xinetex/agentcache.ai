# JettyThunder.app + AgentCache Integration Guide

**Customer**: JettyThunder.app (First Customer 🎉)  
**Plan**: Enterprise  
**Quota**: 500,000 requests/month  
**Rate Limit**: 500 requests/minute

---

## Quick Start

### 1. Get Your API Key

Run the onboarding script to generate your API key:

```bash
cd /Users/letstaco/Documents/agentcache-ai
node scripts/onboard-jettythunder.cjs
```

This will:
- Create a verified user account for `platform@jettythunder.app`
- Generate a live API key starting with `ac_live_jettythunder_...`
- Initialize usage tracking and quota (500k/month)
- Output integration instructions

**Save the API key securely** - you won't be able to retrieve it again!

---

## 2. Add to Environment Variables

In JettyThunder.app's `.env` file:

```bash
AGENTCACHE_API_KEY=ac_live_jettythunder_<your_key_here>
AGENTCACHE_BASE_URL=https://agentcache.ai
```

---

## 3. Integration Options

### Option A: Direct HTTP Integration

Use AgentCache as a middleware before calling your LLM provider:

```javascript
// JettyThunder.app - AI request handler
async function callAI(provider, model, messages) {
  // 1. Check cache first
  const cacheCheck = await fetch('https://agentcache.ai/api/cache/get', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.AGENTCACHE_API_KEY,
      'Content-Type': 'application/json',
      'X-Cache-Namespace': 'jettythunder' // Optional: for isolation
    },
    body: JSON.stringify({
      provider,
      model,
      messages,
      temperature: 0.7 // Include all cache-key params
    })
  });
  
  if (cacheCheck.ok) {
    // Cache HIT - return cached response
    const cached = await cacheCheck.json();
    console.log('✅ Cache hit! Saved ~$0.50');
    return cached.response;
  }
  
  // 2. Cache MISS - call LLM provider
  const response = await callOpenAI(model, messages); // Your existing code
  
  // 3. Store response in cache
  await fetch('https://agentcache.ai/api/cache/set', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.AGENTCACHE_API_KEY,
      'Content-Type': 'application/json',
      'X-Cache-Namespace': 'jettythunder'
    },
    body: JSON.stringify({
      provider,
      model,
      messages,
      temperature: 0.7,
      response
    })
  });
  
  return response;
}
```

### Option B: Multi-Tenant Namespace Support

JettyThunder.app is multi-tenant. You can isolate cache by customer:

```javascript
async function callAIForCustomer(customerId, provider, model, messages) {
  const namespace = `customer_${customerId}`;
  
  const cacheCheck = await fetch('https://agentcache.ai/api/cache/get', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.AGENTCACHE_API_KEY,
      'X-Cache-Namespace': namespace, // Isolate by customer
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ provider, model, messages })
  });
  
  // ... rest of logic
}
```

**Benefits**:
- Prevent customer A from accessing customer B's cached responses
- Track per-customer cache analytics (coming soon)
- Clear cache per customer if needed

---

## 4. API Endpoints Reference

### Check Cache (Primary Endpoint)

**GET /api/cache/get**

```bash
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_live_jettythunder_..." \
  -H "X-Cache-Namespace: customer_123" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ],
    "temperature": 0.7
  }'
```

**Response (Hit)**:
```json
{
  "cached": true,
  "response": {
    "id": "chatcmpl-...",
    "object": "chat.completion",
    "choices": [...]
  },
  "metadata": {
    "cachedAt": 1706028000000,
    "provider": "openai",
    "model": "gpt-4",
    "latencyMs": 45
  }
}
```

**Response (Miss)**:
```json
{
  "error": "Cache miss"
}
// Status: 404
```

---

### Store Response in Cache

**POST /api/cache/set**

```bash
curl -X POST https://agentcache.ai/api/cache/set \
  -H "X-API-Key: ac_live_jettythunder_..." \
  -H "X-Cache-Namespace: customer_123" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [...],
    "response": {
      "id": "chatcmpl-...",
      "choices": [...]
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "cached": true,
  "ttl": 604800
}
```

---

### Check if Cached (Lightweight)

**POST /api/cache/check**

Checks if response is cached without retrieving it. Useful for analytics.

```bash
curl -X POST https://agentcache.ai/api/cache/check \
  -H "X-API-Key: ac_live_jettythunder_..." \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [...]
  }'
```

**Response**:
```json
{
  "cached": true,
  "ttl": 604800
}
```

---

### View Analytics

**GET /api/stats?period=24h**

```bash
curl -X GET "https://agentcache.ai/api/stats?period=24h" \
  -H "X-API-Key: ac_live_jettythunder_..."
```

**Response**:
```json
{
  "period": "24h",
  "namespace": "default",
  "metrics": {
    "total_requests": 15420,
    "cache_hits": 12336,
    "hit_rate": 80.0,
    "tokens_saved": 12336000,
    "cost_saved": "$123.36",
    "avg_latency_ms": 450
  },
  "quota": {
    "monthly_limit": 500000,
    "monthly_used": 45230,
    "monthly_remaining": 454770,
    "usage_percent": 9.05
  },
  "performance": {
    "requests_per_day": 15420,
    "efficiency_score": 80.0,
    "cost_reduction_percent": 72.0
  }
}
```

---

## 5. Cache Key Generation (How It Works)

AgentCache generates deterministic cache keys using SHA-256 hash of:

```javascript
{
  provider: "openai",
  model: "gpt-4",
  messages: [...],
  temperature: 0.7
}
```

**Cache Key Format**:
```
agentcache:v1:customer_123:openai:gpt-4:a1b2c3d4...
         ^          ^         ^      ^     ^
      version   namespace  provider model  hash
```

**Same input → Same key → Cache hit ✅**

---

## 6. Testing the Integration

### Step 1: Test Cache Miss (First Call)

```bash
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
  }'
```

Expected: `404 Cache miss`

### Step 2: Store Response

```bash
curl -X POST https://agentcache.ai/api/cache/set \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "response": {
      "id": "test-123",
      "object": "chat.completion",
      "choices": [{
        "message": {
          "role": "assistant",
          "content": "The capital of France is Paris."
        }
      }]
    }
  }'
```

Expected: `200 { success: true, cached: true }`

### Step 3: Test Cache Hit (Repeat Step 1)

Expected: `200` with cached response in ~50ms (vs ~2000ms for LLM call)

---

## 7. Production Deployment Checklist

- [ ] Run `node scripts/onboard-jettythunder.cjs` to get API key
- [ ] Save API key to JettyThunder.app `.env` file
- [ ] Add cache check logic before LLM calls
- [ ] Add cache storage logic after LLM responses
- [ ] Use `X-Cache-Namespace` header for multi-tenancy
- [ ] Test with demo requests (see above)
- [ ] Monitor stats at `https://agentcache.ai/api/stats?period=24h`
- [ ] Set up alerts for quota approaching limit (90%+)
- [ ] Verify rate limiting (500 req/min) works as expected

---

## 8. Rate Limits & Quotas

| Metric | Limit |
|--------|-------|
| Requests/minute | 500 |
| Monthly quota | 500,000 |
| Cache TTL | 7 days (default) |
| Max message size | 1MB |

**What happens when quota is exceeded?**
- Returns `429 Too Many Requests`
- Response includes quota info:
  ```json
  {
    "error": "Monthly quota exceeded",
    "quota": {
      "limit": 500000,
      "used": 500000,
      "resets_at": "2025-02-01T00:00:00Z"
    }
  }
  ```

---

## 9. Monitoring & Analytics

### Embed Stats in JettyThunder.app Dashboard

```javascript
async function getAgentCacheStats() {
  const res = await fetch('https://agentcache.ai/api/stats?period=7d', {
    headers: {
      'X-API-Key': process.env.AGENTCACHE_API_KEY
    }
  });
  
  const stats = await res.json();
  
  return {
    hitRate: stats.metrics.hit_rate,
    costSaved: stats.metrics.cost_saved,
    quotaUsed: stats.quota.usage_percent,
    avgLatency: stats.metrics.avg_latency_ms
  };
}
```

Display in JettyThunder.app admin panel:
- **Cache Hit Rate**: 80% ✅
- **Cost Savings**: $1,234.56 this month 💰
- **Quota Used**: 45,230 / 500,000 (9%)
- **Avg Latency**: 50ms (vs 2000ms direct)

---

## 10. Troubleshooting

### Issue: "Invalid API key"

**Cause**: API key not properly set or formatted incorrectly.

**Solution**:
- Verify key starts with `ac_live_jettythunder_`
- Check `.env` file has correct key
- Ensure no extra spaces/newlines in key

---

### Issue: "Cache miss" on identical requests

**Cause**: Cache key includes `temperature` or other params that differ.

**Solution**:
- Ensure all cache-key params are consistent:
  ```javascript
  // ❌ BAD - temperature varies
  callAI('gpt-4', messages, Math.random())
  
  // ✅ GOOD - deterministic
  callAI('gpt-4', messages, 0.7)
  ```

---

### Issue: Rate limit exceeded (429)

**Cause**: More than 500 requests/minute.

**Solution**:
- Implement request queuing in JettyThunder.app
- Batch requests when possible
- Contact support to increase rate limit

---

## 11. Cost Savings Calculator

**Average GPT-4 request**: ~1000 tokens × $0.03/1k = $0.03  
**AgentCache cost**: $0.00 (cached)

**Scenario**: JettyThunder.app handles 100k AI requests/month
- **Without cache**: 100k × $0.03 = **$3,000/month**
- **With 80% hit rate**: 20k × $0.03 = **$600/month**
- **Savings**: **$2,400/month** (80% reduction)

**Break-even**: AgentCache pays for itself in cost savings alone!

---

## 12. Support

For JettyThunder.app integration support:
- Email: support@agentcache.ai
- Docs: https://agentcache.ai/docs
- Status: https://status.agentcache.ai (coming soon)

---

## Next Steps

1. ✅ Get API key via onboarding script
2. ✅ Add to JettyThunder.app environment
3. ✅ Implement cache check/set logic
4. ✅ Test with demo requests
5. ✅ Deploy to production
6. 📊 Monitor stats daily
7. 💰 Watch savings accumulate!

**Welcome to AgentCache, JettyThunder! 🚀**
