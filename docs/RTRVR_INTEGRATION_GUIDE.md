# rtrvr.ai × AgentCache Integration Guide

**10x Faster Web Research | 90% Cost Reduction**

---

## 🎯 Why This Integration Matters

rtrvr.ai agents excel at web research, scraping, and competitive intelligence. But every insight requires LLM processing:
- Summarizing scraped content
- Extracting structured data
- Comparing competitors
- Analyzing trends

**The Problem**: Identical web pages analyzed repeatedly = 10x-100x redundant LLM calls

**The Solution**: AgentCache MCP Server caches LLM responses, delivering:
- ⚡ **10-20x faster responses** (50ms vs 2-5 seconds)
- 💰 **80-95% cost reduction** ($500/mo → $50/mo)
- 🎯 **Zero code changes** (drop-in MCP integration)

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- rtrvr.ai account with MCP support
- AgentCache API key (get at https://agentcache.ai)

### Step 1: Install AgentCache MCP Server

```bash
# Clone the repo
git clone https://github.com/agentcache-ai/agentcache-mcp-server
cd agentcache-mcp-server

# Install dependencies
pnpm install

# Build the server
pnpm run mcp:build
```

### Step 2: Configure rtrvr.ai

Add AgentCache to your rtrvr.ai MCP configuration:

```json
{
  "mcpServers": {
    "agentcache": {
      "command": "node",
      "args": ["/path/to/agentcache-ai/dist/mcp/server.js"],
      "env": {
        "AGENTCACHE_API_KEY": "ac_live_YOUR_KEY_HERE",
        "AGENTCACHE_API_URL": "https://agentcache.ai"
      }
    }
  }
}
```

### Step 3: Test the Integration

Create a simple rtrvr.ai workflow:

```javascript
// Example: Research competitor pricing
const workflow = {
  task: "Research top 10 SaaS competitors",
  steps: [
    {
      action: "scrape",
      urls: ["competitor1.com/pricing", "competitor2.com/pricing", ...],
    },
    {
      action: "cache_check",
      mcp: "agentcache",
      tool: "agentcache_get",
      params: {
        provider: "openai",
        model: "gpt-4",
        messages: [
          { role: "system", content: "Extract pricing from HTML" },
          { role: "user", content: "{{scraped_html}}" }
        ],
        namespace: "competitor-research"
      }
    },
    {
      action: "llm_call",
      condition: "cache_miss",
      model: "gpt-4",
      prompt: "Extract pricing from: {{scraped_html}}"
    },
    {
      action: "cache_store",
      mcp: "agentcache",
      tool: "agentcache_set",
      params: {
        provider: "openai",
        model: "gpt-4",
        messages: "{{original_messages}}",
        response: "{{llm_response}}",
        namespace: "competitor-research",
        ttl: 86400 // 24 hours
      }
    }
  ]
};
```

---

## 📊 Real-World Use Case: Competitor Monitoring

### Scenario
Monitor 50 competitors daily, extracting:
- Pricing changes
- Feature updates
- Blog posts
- Social media mentions

### Without AgentCache
```
Cost Calculation:
- 50 competitors × 5 pages each = 250 pages/day
- Each page: ~2,000 tokens to analyze
- GPT-4 cost: $0.03 per 1K input tokens
- Daily cost: 250 × 2 × $0.03 = $15/day
- Monthly cost: $15 × 30 = $450/month
```

### With AgentCache
```
Optimized Cost:
- Day 1: Full analysis ($15)
- Days 2-30: 80% cache hits (only changed pages analyzed)
- Average daily cost: $3/day
- Monthly cost: $3 × 30 = $90/month

💰 Savings: $360/month (80% reduction)
⚡ Speed: Cached responses in <50ms vs 3-5 seconds
```

---

## 🎨 Advanced Patterns

### Pattern 1: Namespace Segmentation

Organize cache by customer or project:

```javascript
// Customer A
params: {
  namespace: "customer-a-research",
  ...
}

// Customer B (isolated cache)
params: {
  namespace: "customer-b-research",
  ...
}

// Shared knowledge base
params: {
  namespace: "shared-industry-data",
  ...
}
```

**Benefit**: Multi-tenant SaaS can offer per-customer caching

---

### Pattern 2: Smart TTL Strategy

Different data types = different cache durations:

```javascript
// Pricing pages (changes infrequently)
ttl: 86400 * 7  // 7 days

// Blog posts (check daily)
ttl: 86400  // 1 day

// Social media (real-time)
ttl: 3600  // 1 hour

// Product features (quarterly updates)
ttl: 86400 * 30  // 30 days
```

---

### Pattern 3: Cache Warming

Pre-populate cache during off-peak hours:

```javascript
// Nightly job: Warm cache for common queries
const warmCacheWorkflow = {
  schedule: "0 2 * * *",  // 2 AM daily
  tasks: [
    {
      action: "prefetch",
      urls: TOP_100_COMPETITOR_URLS,
      mcp: "agentcache",
      tool: "agentcache_set",
      force_refresh: true
    }
  ]
};
```

**Result**: Next-day queries hit warm cache = instant results

---

### Pattern 4: Analytics-Driven Optimization

Monitor cache performance:

```javascript
// Get cache stats
const stats = await agentcache.call_tool("agentcache_stats", {
  period: "7d",
  namespace: "competitor-research"
});

// Analyze
console.log(`Hit rate: ${stats.metrics.hit_rate}%`);
console.log(`Cost saved: ${stats.metrics.cost_saved}`);
console.log(`Tokens saved: ${stats.metrics.tokens_saved}`);

// Optimize
if (stats.metrics.hit_rate < 60) {
  // Increase TTL for frequently accessed data
  updateTTLStrategy();
}
```

---

## 🔧 Troubleshooting

### Issue: Cache misses for identical queries

**Cause**: Temperature parameter variance  
**Solution**: Normalize temperature to 0 for deterministic caching

```javascript
// ❌ Bad (non-deterministic)
messages: [...],
temperature: 0.7  // Small variations = cache miss

// ✅ Good (deterministic)
messages: [...],
temperature: 0.0  // Exact match = cache hit
```

---

### Issue: Stale cache data

**Cause**: TTL too long for frequently changing content  
**Solution**: Implement cache invalidation

```javascript
// Manual invalidation (force refresh)
await agentcache.call_tool("agentcache_set", {
  ...params,
  ttl: 1,  // Expire immediately
  force: true
});

// Then fetch fresh data
const fresh = await scrapeAndAnalyze(url);
await agentcache.call_tool("agentcache_set", {
  ...params,
  response: fresh,
  ttl: 86400
});
```

---

### Issue: High costs despite caching

**Cause**: Low cache hit rate  
**Diagnosis**: Check stats

```javascript
const stats = await agentcache.call_tool("agentcache_stats", {
  period: "24h"
});

if (stats.metrics.hit_rate < 50) {
  // Investigate:
  // 1. Are prompts consistent?
  // 2. Is temperature set to 0?
  // 3. Are messages formatted identically?
  // 4. Is namespace correctly configured?
}
```

---

## 📈 Metrics to Track

### Performance Metrics
```javascript
// Monitor via AgentCache dashboard
{
  cache_hit_rate: 85.2,        // Target: >80%
  avg_latency_cached: 45,      // ms (Target: <50ms)
  avg_latency_uncached: 2800,  // ms
  speedup_factor: 62.2         // 62x faster!
}
```

### Cost Metrics
```javascript
{
  monthly_requests: 12500,
  cache_hits: 10650,
  tokens_saved: 21300000,
  cost_without_cache: 639.00,  // USD
  cost_with_cache: 55.50,      // USD
  savings: 583.50,             // USD (91.3%)
  roi: 1051                    // 10.5x return
}
```

---

## 🎯 Best Practices

### 1. **Namespace Hygiene**
```javascript
// ✅ Good: Descriptive, hierarchical
namespace: "rtrvr/competitor-research/pricing"

// ❌ Bad: Generic, collision-prone
namespace: "cache"
```

### 2. **Prompt Consistency**
```javascript
// ✅ Good: Templated, deterministic
const prompt = `Extract pricing from the following HTML:\n\n${html}`;

// ❌ Bad: Variable formatting
const prompt = `Can you extract pricing info from:\n${html}`; // Different wording = cache miss
```

### 3. **Progressive Enhancement**
```javascript
// Start with aggressive caching
ttl: 86400 * 30  // 30 days

// Monitor hit rate
if (hit_rate < 70) {
  // Tune TTL down
  ttl: 86400 * 7  // 7 days
}
```

### 4. **Error Handling**
```javascript
try {
  const cached = await agentcache.call_tool("agentcache_get", params);
  if (cached.cached) {
    return cached.response;
  }
} catch (error) {
  console.warn("AgentCache unavailable, falling back to direct LLM call");
}

// Fallback: Direct LLM call
const response = await openai.chat.completions.create(...);
```

---

## 🚀 Migration Checklist

- [ ] AgentCache API key obtained
- [ ] MCP server installed and built
- [ ] rtrvr.ai MCP configuration updated
- [ ] Test workflow runs successfully
- [ ] Cache hit rate >70% after 24 hours
- [ ] Cost savings validated in dashboard
- [ ] Team trained on namespace conventions
- [ ] Monitoring alerts configured
- [ ] Backup/fallback strategy tested

---

## 💡 Pro Tips

### Tip 1: Semantic Deduplication
```javascript
// Same meaning, different wording = cache hit (coming soon)
// "Extract pricing" vs "Get price information" → SAME cached response
```

### Tip 2: Multi-LLM Strategy
```javascript
// Use cached GPT-4 responses with Claude for validation
const gpt4Result = await agentcache.get("gpt-4", prompt);
const claudeResult = await agentcache.get("claude-3", prompt);

// Synthesize best answer
const final = synthesize([gpt4Result, claudeResult]);
```

### Tip 3: Cache as Feature
```javascript
// Offer instant reports to customers
"Your competitor analysis is ready!" (cached from yesterday)
vs
"Analyzing 50 competitors... ETA: 5 minutes" (no cache)
```

---

## 📞 Support

- **Documentation**: https://docs.agentcache.ai
- **Discord**: https://discord.gg/agentcache
- **Email**: support@agentcache.ai
- **Status**: https://status.agentcache.ai

---

## 🎉 Success Stories

> "We reduced our rtrvr.ai research costs from $1,200/month to $180/month with AgentCache. Same quality, 10x faster results."  
> — *SaaS Analytics Platform*

> "Our competitor monitoring agents now deliver instant reports. Customers love the speed improvement."  
> — *Market Intelligence Startup*

> "AgentCache paid for itself in the first week. Essential infrastructure for any AI agent platform."  
> — *Web Scraping SaaS*

---

## 🔮 Coming Soon

- **Semantic Cache**: Similar prompts = cache hits (20-40% more savings)
- **Federated Cache**: Global low-latency cache network
- **Auto-Optimization**: AI-powered TTL tuning
- **Custom Embeddings**: Domain-specific similarity matching

---

**Ready to 10x your rtrvr.ai agents?**

Get started: https://agentcache.ai/rtrvr

**Demo Request**: sales@agentcache.ai
