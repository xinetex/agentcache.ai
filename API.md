# AgentCache API Reference

## Base URL
```
https://agentcache.ai
```

## Authentication

All API requests require an API key via one of these methods:

```bash
# Header: X-API-Key
curl -H "X-API-Key: ac_demo_test123" ...

# Header: Authorization Bearer
curl -H "Authorization: Bearer ac_demo_test123" ...
```

### Demo Keys
- Format: `ac_demo_*`
- Rate limit: 100 requests/minute
- No registration required

### Live Keys
- Format: `ac_live_*`
- Rate limit: 500 requests/minute
- Sign up at https://agentcache.ai/login.html

---

## Endpoints

### 1. Cache GET

Check if a response is cached.

**Endpoint:** `POST /api/cache/get`

**Request:**
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7
}
```

**Response (Cache Hit):**
```json
{
  "hit": true,
  "response": "Hello! How can I help you today?"
}
```

**Response (Cache Miss):**
```json
{
  "hit": false
}
```

---

### 2. Cache SET

Store a response in cache.

**Endpoint:** `POST /api/cache/set`

**Request:**
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7,
  "response": "Hello! How can I help you today?",
  "ttl": 604800
}
```

**Response:**
```json
{
  "success": true,
  "key": "...abc123",
  "ttl": 604800
}
```

**Parameters:**
- `ttl` (optional): Time to live in seconds. Default: 604800 (7 days)

---

### 3. Cache CHECK

Check if response is cached and get TTL.

**Endpoint:** `POST /api/cache/check`

**Request:**
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

**Response:**
```json
{
  "cached": true,
  "ttl": 604234
}
```

---

### 4. Swarm Execution

Execute multi-model AI swarm with observability.

**Endpoint:** `POST /api/swarm`

**Request:**
```json
{
  "strategy": "parallel",
  "models": [
    {"provider": "openai", "model": "gpt-4"},
    {"provider": "anthropic", "model": "claude-3-opus"},
    {"provider": "google", "model": "gemini-pro"}
  ],
  "messages": [
    {"role": "user", "content": "Explain quantum computing"}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "traceId": "trace_1700000000000_abc123",
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
    }
  ],
  "observability": {
    "traceUrl": "/api/trace?id=trace_1700000000000_abc123",
    "dashboardUrl": "/swarm-observability.html?traceId=trace_1700000000000_abc123",
    "totalLatency": 45,
    "cacheHits": 2,
    "cacheMisses": 1,
    "cacheHitRate": 66.7,
    "errors": 0
  }
}
```

**Strategies:**
- `parallel` - Execute all models, return all results
- `consensus` - All models vote, majority wins
- `fastest` - Race all models, return first success
- `cheapest` - Try cheapest first, fallback to others
- `best-quality` - Use highest quality model

**Optional Headers:**
- `X-Trace-ID`: Custom trace ID
- `X-Cache-Namespace`: Namespace for multi-tenancy

---

### 5. Trace Retrieval

Get detailed trace data for a swarm execution.

**Endpoint:** `GET /api/trace?id=TRACE_ID`

**Response:**
```json
{
  "traceId": "trace_1700000000000_abc123",
  "strategy": "parallel",
  "timestamp": 1700000000000,
  "date": "2025-11-18T22:00:00.000Z",
  "summary": {
    "totalModels": 3,
    "totalSpans": 3,
    "totalLatency": 45,
    "avgLatency": 15,
    "cacheHits": 2,
    "cacheMisses": 1,
    "cacheHitRate": 66.7,
    "errors": 0,
    "totalCost": "0.000015",
    "estimatedSavings": "0.045230",
    "savingsPercent": "99.97"
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
  "spans": [...],
  "results": [...]
}
```

---

### 6. Statistics

Get usage and performance statistics.

**Endpoint:** `GET /api/stats?period=24h`

**Response:**
```json
{
  "period": "24h",
  "metrics": {
    "total_requests": 15420,
    "cache_hits": 12336,
    "hit_rate": 80.0,
    "tokens_saved": 12336000,
    "cost_saved": "$123.36",
    "avg_latency_ms": 450
  },
  "quota": {
    "monthly_limit": 150000,
    "monthly_used": 45230,
    "monthly_remaining": 104770,
    "usage_percent": 30.2
  }
}
```

---

### 7. Health Check

Check API health and Redis connectivity.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-18T22:00:00.000Z",
  "redis": "connected",
  "version": "1.0.0"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (invalid payload)
- `401` - Unauthorized (invalid API key)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limits

### Demo Keys (`ac_demo_*`)
- 100 requests per minute
- Unlimited models per swarm
- 7-day trace retention

### Live Keys (`ac_live_*`)
- 500 requests per minute
- Unlimited models per swarm
- 7-day trace retention
- Monthly quota tracking

**Rate Limit Headers:**
```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 499
X-RateLimit-Reset: 1700000060
```

---

## Caching Behavior

### Cache Key Generation
Deterministic SHA-256 hash of:
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "messages": [...],
  "temperature": 0.7
}
```

### Cache TTL
- Default: 7 days (604800 seconds)
- Configurable per request
- Automatic expiration

### Namespace Isolation
Use `X-Cache-Namespace` header for multi-tenant caching:
```bash
curl -H "X-Cache-Namespace: customer-123" ...
```

---

## Best Practices

### 1. Warm the Cache
Prime cache with common queries before production:
```bash
# First run - populate cache
curl -X POST /api/cache/set ...

# Subsequent runs - instant response
curl -X POST /api/cache/get ...
```

### 2. Use Appropriate Strategy
- **Development**: `parallel` (compare models)
- **Production (accuracy)**: `consensus` (reduce hallucinations)
- **Production (speed)**: `fastest` (minimize latency)
- **Production (cost)**: `cheapest` (maximize savings)

### 3. Monitor Traces
View detailed execution data:
```
https://agentcache.ai/swarm-observability.html?traceId=YOUR_TRACE_ID
```

### 4. Handle Cache Misses
```javascript
const result = await fetch('/api/swarm', {...});

for (const r of result.results) {
  if (r.cacheMiss) {
    // Call your LLM provider
    const response = await callLLM(r.provider, r.model, messages);
    
    // Store in cache
    await fetch('/api/cache/set', {
      body: JSON.stringify({
        provider: r.provider,
        model: r.model,
        messages,
        response
      })
    });
  }
}
```

---

## Examples

### Node.js
```javascript
const response = await fetch('https://agentcache.ai/api/swarm', {
  method: 'POST',
  headers: {
    'X-API-Key': 'ac_demo_test123',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    strategy: 'parallel',
    models: [
      { provider: 'openai', model: 'gpt-4' },
      { provider: 'anthropic', model: 'claude-3-opus' }
    ],
    messages: [{ role: 'user', content: 'Hello' }]
  })
});

const data = await response.json();
console.log('Trace:', data.traceId);
```

### Python
```python
import requests

response = requests.post('https://agentcache.ai/api/swarm',
    headers={'X-API-Key': 'ac_demo_test123'},
    json={
        'strategy': 'consensus',
        'models': [
            {'provider': 'openai', 'model': 'gpt-4'},
            {'provider': 'google', 'model': 'gemini-pro'}
        ],
        'messages': [{'role': 'user', 'content': 'Hello'}]
    }
)

data = response.json()
print(f"Trace: {data['traceId']}")
```

### cURL
```bash
curl -X POST https://agentcache.ai/api/swarm \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "fastest",
    "models": [
      {"provider": "openai", "model": "gpt-4o-mini"},
      {"provider": "google", "model": "gemini-flash"}
    ],
    "messages": [{"role": "user", "content": "Quick test"}]
  }'
```

---

## Support

- **Documentation**: https://agentcache.ai/docs.html
- **Swarm Guide**: https://github.com/xinetex/agentcache.ai/blob/main/SWARM.md
- **Dashboard**: https://agentcache.ai/swarm-observability.html
- **Email**: support@agentcache.ai
- **GitHub**: https://github.com/xinetex/agentcache.ai
