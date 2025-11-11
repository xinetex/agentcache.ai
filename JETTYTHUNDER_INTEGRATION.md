# JettyThunder.app Integration Guide

## Quick Start

Welcome to AgentCache.ai! This guide will help you integrate caching into your agent platform in under 10 minutes.

### Your API Key

```
Demo: ac_demo_test123 (for testing)
Production: [to be provided]
```

### Base URL

```
https://agentcache.ai/api
```

---

## Integration Patterns

### Pattern 1: Simple Cache Wrapper

Add this around your existing LLM calls:

```typescript
// Before calling OpenAI/Anthropic/etc.
async function callLLMWithCache(provider, model, messages) {
  const apiKey = 'ac_demo_test123'; // Use your production key
  
  // 1. Check cache first
  const cacheCheck = await fetch('https://agentcache.ai/api/cache/get', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ provider, model, messages })
  });
  
  if (cacheCheck.ok) {
    const cached = await cacheCheck.json();
    if (cached.hit) {
      console.log('💚 Cache hit! Saved ~$0.03, latency: 25ms');
      return cached.response;
    }
  }
  
  // 2. Cache miss - call your LLM
  const response = await yourLLMCall(provider, model, messages);
  
  // 3. Store in cache for next time
  await fetch('https://agentcache.ai/api/cache/set', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      provider,
      model,
      messages,
      response,
      ttl: 604800 // 7 days (optional)
    })
  });
  
  return response;
}
```

### Pattern 2: Multi-Tenant (Recommended for JettyThunder.app)

Segment caching by customer:

```typescript
async function callLLMForCustomer(customerId, provider, model, messages) {
  const namespace = `customer_${customerId}`;
  
  const cacheCheck = await fetch('https://agentcache.ai/api/cache/get', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.AGENTCACHE_API_KEY,
      'X-Cache-Namespace': namespace, // 👈 Isolate by customer
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ provider, model, messages })
  });
  
  // ... rest same as Pattern 1
}
```

**Why?** Each JettyThunder customer gets isolated cache. Customer A's prompts won't pollute Customer B's cache.

### Pattern 3: Agent-Specific TTLs

Different agents need different cache lifetimes:

```typescript
const CACHE_TTL = {
  research_agent: 7 * 24 * 60 * 60,    // 7 days (research is timeless)
  coding_agent: 1 * 60 * 60,            // 1 hour (code changes fast)
  support_agent: 24 * 60 * 60,          // 24 hours (help docs update daily)
  data_agent: 5 * 60                    // 5 minutes (real-time data)
};

async function callWithAgentTTL(agentType, provider, model, messages) {
  const ttl = CACHE_TTL[agentType] || 86400; // default 1 day
  
  // ... cache check ...
  
  // When storing:
  await fetch('https://agentcache.ai/api/cache/set', {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({
      provider, model, messages, response,
      ttl // 👈 Custom TTL per agent type
    })
  });
}
```

---

## Dashboard Integration

Embed real-time stats in your JettyThunder.app dashboard:

### Option 1: Direct API Call

```typescript
// Fetch stats for display
async function getAgentCacheStats() {
  const res = await fetch('https://agentcache.ai/api/stats?period=24h', {
    headers: {
      'X-API-Key': process.env.AGENTCACHE_API_KEY
    }
  });
  
  const stats = await res.json();
  return {
    hitRate: stats.metrics.hit_rate,
    costSaved: stats.metrics.cost_saved,
    requests: stats.metrics.total_requests,
    quotaRemaining: stats.quota.monthly_remaining
  };
}

// Update UI every 30 seconds
setInterval(async () => {
  const stats = await getAgentCacheStats();
  updateDashboard(stats);
}, 30000);
```

### Option 2: Embeddable Widget (Coming Soon)

```html
<!-- Future feature -->
<iframe 
  src="https://agentcache.ai/embed/stats?key=ac_live_xxx&theme=dark"
  width="400" 
  height="200"
  frameborder="0"
></iframe>
```

---

## Monitoring & Alerts

### Health Check

Monitor AgentCache.ai uptime:

```bash
curl https://agentcache.ai/api/health

# Response:
{
  "status": "healthy",
  "checks": {
    "api": "healthy",
    "redis": "healthy"
  },
  "performance": {
    "api_latency_ms": 12,
    "redis_latency_ms": 8
  }
}
```

**Recommendation**: Poll every 1 minute. Alert if status != "healthy".

### Quota Warnings

Get notified before you hit quota limits:

```typescript
async function checkQuota() {
  const stats = await getAgentCacheStats();
  
  if (stats.quota.usage_percent > 80) {
    await sendSlackAlert(
      `⚠️ AgentCache quota at ${stats.quota.usage_percent}%. Consider upgrading.`
    );
  }
}

// Run daily
setInterval(checkQuota, 24 * 60 * 60 * 1000);
```

---

## Rate Limiting

AgentCache protects against runaway agents:

- **Your limits**: 500 requests/minute
- **If exceeded**: 429 response with `Retry-After` header

**Handling**:
```typescript
async function callWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '60');
      console.log(`Rate limited. Retrying in ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }
    
    return res;
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## Cost Optimization Tips

### 1. Use Namespaces Strategically

```typescript
// ✅ Good: Segment by customer
X-Cache-Namespace: customer_abc

// ✅ Good: Segment by workflow
X-Cache-Namespace: workflow_onboarding

// ❌ Bad: Too granular (defeats caching)
X-Cache-Namespace: session_${uuid}
```

### 2. Normalize Prompts

Agents often add timestamps or session IDs. Strip these before caching:

```typescript
function normalizeMessages(messages) {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
      .replace(/\[Timestamp: .*?\]/g, '') // Remove timestamps
      .replace(/Session ID: \w+/g, '')     // Remove session IDs
      .trim()
  }));
}

const normalized = normalizeMessages(messages);
// Now cache with normalized version
```

### 3. Monitor Hit Rates

Track which agents benefit most from caching:

```typescript
async function trackAgentPerformance(agentType, cacheHit) {
  // Log to your analytics
  await logMetric('agent_cache_hit', {
    agent_type: agentType,
    cache_hit: cacheHit,
    timestamp: new Date()
  });
}

// Analyze weekly: Which agents have <50% hit rate?
// Those might need prompt optimization or shorter TTLs
```

---

## Error Handling

Always have a fallback:

```typescript
async function resilientLLMCall(provider, model, messages) {
  try {
    // Try cache first
    const cached = await checkCache(provider, model, messages);
    if (cached) return cached;
  } catch (err) {
    console.error('Cache check failed:', err);
    // Fall through to direct LLM call
  }
  
  // Always call LLM if cache fails
  const response = await callLLM(provider, model, messages);
  
  try {
    // Try to cache response (fire-and-forget)
    await storeInCache(provider, model, messages, response);
  } catch (err) {
    console.error('Cache store failed:', err);
    // Don't block on cache failures
  }
  
  return response;
}
```

**Key principle**: Cache failures should never break your agents.

---

## Performance Expectations

| Metric | Target | Notes |
|--------|--------|-------|
| Cache hit latency | <50ms P95 | From JettyThunder.app to AgentCache |
| Cache miss overhead | <10ms | Extra latency vs. direct LLM call |
| Uptime | 99.9%+ | ~8 hours downtime per year max |
| Hit rate (typical) | 60-85% | Depends on agent type and workload |

### Calculating ROI

```typescript
// Example: 100K requests/month
const monthlyRequests = 100000;
const avgHitRate = 0.75; // 75%

const cacheHits = monthlyRequests * avgHitRate;
const cacheMisses = monthlyRequests * (1 - avgHitRate);

// Cost breakdown
const avgCostPerLLMCall = 0.03; // $0.03 for GPT-4
const costWithoutCache = monthlyRequests * avgCostPerLLMCall;
const costWithCache = cacheMisses * avgCostPerLLMCall;

const savings = costWithoutCache - costWithCache;
const agentCacheFee = 299; // Agent Pro plan

const netSavings = savings - agentCacheFee;

console.log(`
Without cache: $${costWithoutCache.toFixed(2)}
With cache: $${costWithCache.toFixed(2)} + $${agentCacheFee} = $${(costWithCache + agentCacheFee).toFixed(2)}
Net savings: $${netSavings.toFixed(2)}/month
ROI: ${((netSavings / agentCacheFee) * 100).toFixed(0)}%
`);

// Output:
// Without cache: $3,000.00
// With cache: $750.00 + $299 = $1,049.00
// Net savings: $1,951.00/month
// ROI: 653%
```

---

## Testing Checklist

Before going live, verify:

- [ ] Cache hit returns in <100ms
- [ ] Cache miss falls back to LLM correctly
- [ ] Rate limiting handled gracefully
- [ ] Stats API accessible from your dashboard
- [ ] Health checks alerting properly
- [ ] Namespacing isolates customer data
- [ ] Error handling never breaks agents

### Test Script

```bash
# 1. Test cache miss
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Test prompt '$(date +%s)'"}]
  }'
# Expected: 404 (cache miss)

# 2. Store response
curl -X POST https://agentcache.ai/api/cache/set \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Test prompt FIXED"}],
    "response": "This is a test response"
  }'
# Expected: 200 (success)

# 3. Test cache hit
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Test prompt FIXED"}]
  }'
# Expected: 200 with cached response

# 4. Test stats
curl https://agentcache.ai/api/stats?period=24h \
  -H "X-API-Key: ac_demo_test123"
# Expected: 200 with metrics

# 5. Test health
curl https://agentcache.ai/api/health
# Expected: 200 with status: "healthy"
```

---

## Support & SLA

### Incident Response

- **P0 (Outage)**: Response within 15 minutes, resolution target <1 hour
- **P1 (Degraded)**: Response within 1 hour, resolution target <4 hours
- **P2 (Issue)**: Response within 4 hours, resolution target <24 hours

### Contact

- **Urgent (P0/P1)**: [Your phone/Slack]
- **Non-urgent**: support@agentcache.ai
- **Status page**: https://status.agentcache.ai (coming soon)

### Guaranteed Uptime

- **Current (Beta)**: 99.9% (best effort)
- **Agent Pro**: 99.95% with SLA credits
- **Enterprise**: 99.99% with financial penalties

---

## Roadmap (Next 90 Days)

### Phase 1 (Week 1-2) ✅
- [x] Namespace support
- [x] Stats API
- [x] Rate limiting
- [x] Enhanced health checks

### Phase 2 (Week 3-4)
- [ ] Webhook notifications (quota warnings, anomalies)
- [ ] Embeddable dashboard widget
- [ ] Per-namespace analytics
- [ ] Cost breakdown by agent type

### Phase 3 (Week 5-8)
- [ ] Semantic caching (similar prompts)
- [ ] Tool call caching
- [ ] Session memory
- [ ] LangChain SDK

### Phase 4 (Month 3)
- [ ] Multi-region support
- [ ] Custom cache policies
- [ ] PII detection/redaction
- [ ] Audit logs

---

## FAQ

**Q: What happens if AgentCache is down?**  
A: Your agents will experience cache misses and call LLMs directly. Implement the resilient pattern above to ensure zero disruption.

**Q: Can I cache responses from multiple LLM providers?**  
A: Yes! AgentCache supports OpenAI, Anthropic, Moonshot, Cohere, Together, Groq, and any provider with REST APIs.

**Q: How do I invalidate cache entries?**  
A: Currently, cache expires based on TTL. Manual invalidation via API coming in Phase 2.

**Q: Does caching violate OpenAI's terms of service?**  
A: No. You're caching your own requests and responses. Many companies do this (see: Helicone, Portkey, etc.).

**Q: What data does AgentCache store?**  
A: Only cache keys (hashes), responses, and usage metadata. We never store API keys or PII (detection coming soon).

**Q: Can I self-host AgentCache?**  
A: Not yet, but self-hosted option planned for Q3 2025.

---

## Let's Go! 🚀

You're ready to integrate AgentCache into JettyThunder.app. Start with the demo key (`ac_demo_test123`) and test the patterns above.

**Next steps:**
1. Add cache wrapper to your most-used agent
2. Monitor hit rate via stats API
3. Add namespacing for customer isolation
4. Email us your results: support@agentcache.ai

We're here to help you save thousands on LLM costs. Let's build the future of agentic AI together! 💪
