# AgentCache Swarm: Multi-Model AI Orchestration with Deep Observability

## Overview

AgentCache Swarm is a professional-grade multi-model AI orchestration system that enables:

- **Parallel execution** across multiple LLM providers
- **Intelligent routing strategies** (consensus, fastest, cheapest)
- **Deep observability** with distributed tracing
- **Cost tracking** across all models
- **Automatic caching** for all swarm executions

## Quick Start

### Basic Parallel Execution

```bash
curl -X POST https://agentcache.ai/api/swarm \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "models": [
      {"provider": "openai", "model": "gpt-4"},
      {"provider": "anthropic", "model": "claude-3-opus"},
      {"provider": "google", "model": "gemini-pro"}
    ],
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ],
    "strategy": "parallel"
  }'
```

### Response

```json
{
  "success": true,
  "traceId": "trace_1700000000000_abc123xyz",
  "strategy": "parallel",
  "models": 3,
  "results": [
    {
      "provider": "openai",
      "model": "gpt-4",
      "cached": true,
      "latency": 12,
      "cost": 0,
      "estimatedSavings": 0.0234,
      "response": "Quantum computing is..."
    },
    // ... more results
  ],
  "observability": {
    "traceUrl": "/api/trace/trace_1700000000000_abc123xyz",
    "totalLatency": 45,
    "cacheHits": 2,
    "cacheMisses": 1,
    "cacheHitRate": 66.67,
    "errors": 0
  }
}
```

## Swarm Strategies

### 1. **Parallel** (Default)
Executes all models simultaneously, returns all results.

**Use Case:** A/B testing, consensus building, quality comparison

```json
{
  "strategy": "parallel",
  "models": [...]
}
```

**Benefits:**
- See how different models respond to the same prompt
- Build consensus from multiple AI perspectives
- Compare quality/style across providers

---

### 2. **Consensus**
All models vote, majority response wins.

**Use Case:** High-stakes decisions where accuracy > speed

```json
{
  "strategy": "consensus",
  "models": [
    {"provider": "openai", "model": "gpt-4"},
    {"provider": "anthropic", "model": "claude-3-opus"},
    {"provider": "google", "model": "gemini-pro"}
  ]
}
```

**Benefits:**
- Reduces hallucination risk
- Improves accuracy for critical applications
- Provides confidence scores

---

### 3. **Fastest**
Race all models, return first successful response.

**Use Case:** Low-latency applications, user-facing chatbots

```json
{
  "strategy": "fastest"
}
```

**Benefits:**
- Minimize user wait time
- Automatic failover if one provider is slow
- Best for cached queries (sub-20ms response)

---

### 4. **Cheapest**
Try models in order of cost, use first cache hit.

**Use Case:** Cost-sensitive applications, high-volume queries

```json
{
  "strategy": "cheapest"
}
```

**Order of execution:**
1. Gemini Flash ($0.075/$0.30 per 1M tokens)
2. GPT-4o-mini ($0.15/$0.60)
3. Claude Haiku ($0.25/$1.25)
4. ... (more expensive models)

**Benefits:**
- Maximize cost savings
- Intelligent fallback to premium models
- Perfect for cached queries

---

### 5. **Best-Quality**
Use highest-quality model, cache for others.

**Use Case:** Premium features, complex reasoning

```json
{
  "strategy": "best-quality",
  "models": [
    {"provider": "openai", "model": "gpt-4"},
    {"provider": "anthropic", "model": "claude-3-opus"}
  ]
}
```

## Deep Observability

### Trace Visualization

Every swarm execution generates a detailed trace:

```bash
# View trace in browser
https://agentcache.ai/swarm-observability.html?traceId=trace_1700000000000_abc123xyz

# Or via API
curl https://agentcache.ai/api/trace?id=trace_1700000000000_abc123xyz
```

### Trace Data Includes:

- **Per-model latency** (P50, P95, P99)
- **Cache hit rates** by provider
- **Cost breakdown** (actual vs. estimated savings)
- **Error rates** and failure patterns
- **Timeline visualization** of parallel execution

### Example Trace Response

```json
{
  "traceId": "trace_1700000000000_abc123xyz",
  "strategy": "parallel",
  "timestamp": 1700000000000,
  "summary": {
    "totalModels": 3,
    "totalSpans": 3,
    "totalLatency": 45,
    "avgLatency": 15,
    "cacheHits": 2,
    "cacheMisses": 1,
    "cacheHitRate": 66.67,
    "errors": 0,
    "totalCost": 0.000015,
    "estimatedSavings": 0.045230,
    "savingsPercent": 99.97
  },
  "byProvider": [
    {
      "provider": "openai",
      "requests": 1,
      "cached": 1,
      "errors": 0,
      "avgLatency": 12,
      "models": ["gpt-4"]
    }
  ],
  "spans": [...]
}
```

## Use Cases

### 1. Medical Diagnosis Assistant

```javascript
const swarm = await fetch('/api/swarm', {
  method: 'POST',
  headers: { 'X-API-Key': apiKey },
  body: JSON.stringify({
    strategy: 'consensus',
    models: [
      { provider: 'openai', model: 'gpt-4' },
      { provider: 'anthropic', model: 'claude-3-opus' },
      { provider: 'google', model: 'gemini-pro' }
    ],
    messages: [
      { role: 'system', content: 'You are a medical diagnosis assistant.' },
      { role: 'user', content: patientSymptoms }
    ]
  })
});

// All 3 models analyze symptoms
// Consensus reduces hallucination risk
// First run: ~$0.50 cost
// Subsequent identical cases: $0.00 (cached)
```

### 2. Real-Time Customer Support

```javascript
const swarm = await fetch('/api/swarm', {
  method: 'POST',
  headers: { 'X-API-Key': apiKey },
  body: JSON.stringify({
    strategy: 'fastest',
    models: [
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'google', model: 'gemini-flash' },
      { provider: 'anthropic', model: 'claude-3-haiku' }
    ],
    messages: customerQuery
  })
});

// Race 3 fast models
// Return first response (typically 10-20ms with cache)
// Automatic failover if one provider is slow
```

### 3. Enterprise Data Analysis

```javascript
// Manager agent breaks down task
const breakdown = await callLLM('gpt-4', 'Break down this analysis into subtasks');

// Worker swarm executes subtasks in parallel
const results = await Promise.all(
  breakdown.subtasks.map(task => 
    fetch('/api/swarm', {
      method: 'POST',
      body: JSON.stringify({
        strategy: 'cheapest',
        models: [
          { provider: 'google', model: 'gemini-flash' },
          { provider: 'openai', model: 'gpt-4o-mini' }
        ],
        messages: task
      })
    })
  )
);

// Validator checks consistency
const validated = await callLLM('claude-3-opus', 'Validate these results');
```

## Cost Optimization

### Without Swarm
```
Single query to GPT-4: $0.03
100 similar queries: $3.00
1000 queries: $30.00
```

### With Swarm (parallel strategy)
```
First query (3 models): $0.09
Next 99 queries: $0.00 (100% cache hit)
Next 900 queries: $0.00
Total: $0.09 (99.7% savings)
```

### With Swarm (cheapest strategy)
```
First query (tries Gemini Flash): $0.0005
Next 999 queries: $0.00 (cached)
Total: $0.0005 (99.998% savings)
```

## Advanced Features

### Custom Trace IDs

```bash
curl -X POST https://agentcache.ai/api/swarm \
  -H "X-Trace-ID: my-custom-trace-id" \
  -d '{...}'
```

### Namespace Isolation

```bash
curl -X POST https://agentcache.ai/api/swarm \
  -H "X-Cache-Namespace: customer-123" \
  -d '{...}'
```

### Temperature Control

```json
{
  "models": [
    {"provider": "openai", "model": "gpt-4", "temperature": 0.7},
    {"provider": "anthropic", "model": "claude-3-opus", "temperature": 0.9}
  ]
}
```

## Monitoring & Alerts

### Real-Time Metrics

```bash
# Get swarm analytics
curl https://agentcache.ai/api/stats?period=24h

{
  "swarm": {
    "total_requests": 1523,
    "avg_models_per_request": 2.8,
    "avg_latency": 34,
    "cache_hit_rate": 78.2,
    "total_cost": 0.45,
    "estimated_savings": 89.30
  }
}
```

### Trace Retention

- Traces stored for **7 days**
- Retrievable via `/api/trace?id=YOUR_TRACE_ID`
- Automatic cleanup after TTL

## Integration Examples

### Node.js

```typescript
import { AgentCacheSwarm } from 'agentcache-client';

const swarm = new AgentCacheSwarm('ac_live_your_key');

const result = await swarm.execute({
  strategy: 'consensus',
  models: [
    { provider: 'openai', model: 'gpt-4' },
    { provider: 'anthropic', model: 'claude-3-opus' }
  ],
  messages: [{ role: 'user', content: 'Hello' }]
});

console.log('Trace:', result.traceId);
console.log('Cache hit rate:', result.observability.cacheHitRate);
```

### Python

```python
import requests

response = requests.post('https://agentcache.ai/api/swarm',
  headers={'X-API-Key': 'ac_live_your_key'},
  json={
    'strategy': 'parallel',
    'models': [
      {'provider': 'openai', 'model': 'gpt-4'},
      {'provider': 'google', 'model': 'gemini-pro'}
    ],
    'messages': [{'role': 'user', 'content': 'Hello'}]
  }
)

data = response.json()
print(f"Trace: {data['traceId']}")
print(f"View: https://agentcache.ai/swarm-observability.html?traceId={data['traceId']}")
```

## Best Practices

### 1. Cache Warming
Prime the cache with common queries before production:

```bash
# Warm cache with top 100 customer queries
for query in common_queries:
    execute_swarm(query)  # First run populates cache
    # Subsequent runs are instant
```

### 2. Strategy Selection

- **Development/Testing**: Use `parallel` to compare models
- **Production (accuracy-critical)**: Use `consensus`
- **Production (latency-critical)**: Use `fastest`
- **Production (cost-critical)**: Use `cheapest`

### 3. Observability Integration

```javascript
// Send traces to your monitoring system
const result = await executeSwarm({...});

await sendToDatadog({
  metric: 'swarm.latency',
  value: result.observability.totalLatency,
  tags: [`strategy:${result.strategy}`]
});
```

### 4. Error Handling

```javascript
const result = await executeSwarm({
  strategy: 'parallel',
  models: [...]
});

// Check for errors
const errors = result.results.filter(r => r.error);
if (errors.length > 0) {
  console.log('Some models failed:', errors);
  // Use successful results
  const success = result.results.filter(r => !r.error);
}
```

## Pricing

Swarm executions count as individual cache requests per model:

- **Demo keys**: 100 requests/min (free)
- **Starter**: 10,000 requests/mo ($9/mo)
- **Pro**: 100,000 requests/mo ($49/mo)
- **Enterprise**: Custom pricing

**Note**: Cache hits are free regardless of how many models you query!

## Roadmap

- [ ] Automatic model selection based on historical performance
- [ ] Custom consensus algorithms (weighted voting, confidence scoring)
- [ ] Real-time trace streaming via WebSocket
- [ ] Integration with LangChain, LlamaIndex, CrewAI
- [ ] ML-powered cost prediction
- [ ] Automatic A/B testing and model optimization

## Support

- **Documentation**: https://agentcache.ai/docs.html
- **Dashboard**: https://agentcache.ai/swarm-observability.html
- **API Reference**: https://agentcache.ai/api
- **GitHub**: https://github.com/xinetex/agentcache.ai
- **Email**: support@agentcache.ai

---

**Built with ❤️ by the AgentCache team**
