# Webhook System & Kimi K2 Integration Guide

## Overview

AgentCache.ai now supports **real-time webhooks** for proactive agent monitoring and **Kimi K2 integration** for reasoning token caching.

---

## 1. Webhook System

### Quick Start

Register a webhook to receive real-time notifications:

```bash
curl -X POST https://agentcache.ai/api/webhooks \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/agentcache",
    "events": ["quota.warning", "quota.exceeded"],
    "secret": "your_webhook_secret_123"
  }'
```

**Response**:
```json
{
  "success": true,
  "webhook": {
    "url": "https://your-app.com/webhooks/agentcache",
    "events": ["quota.warning", "quota.exceeded"],
    "secret": "your_webhook_secret_123",
    "enabled": true
  },
  "note": "Webhook registered successfully. Verify signature using HMAC-SHA256 with your secret."
}
```

### Available Events

| Event | Trigger | Data Included |
|-------|---------|---------------|
| `quota.warning` | Quota reaches 80% | `{ quota, used, remaining, percent }` |
| `quota.exceeded` | Quota limit reached | `{ quota, used }` |
| `cache.hit` | Successful cache hit | `{ provider, model, namespace, latency_ms }` |
| `cache.miss` | Cache miss occurred | `{ provider, model, messages_hash }` |
| `anomaly.detected` | Unusual patterns | `{ anomaly_type, details }` |
| `context.expired` | Cached context expired | `{ context_id, expired_at }` |
| `performance.degraded` | API latency spike | `{ avg_latency_ms, threshold }` |
| `reasoning.cached` | Kimi K2 reasoning cached | `{ reasoning_tokens, cost_saved }` |
| `reasoning.reused` | Cached reasoning reused | `{ reasoning_tokens, cost_saved }` |

### Receiving Webhooks

**JettyThunder.app example**:

```typescript
// POST /webhooks/agentcache
export async function POST(req: Request) {
  const signature = req.headers.get('X-AgentCache-Signature');
  const event = req.headers.get('X-AgentCache-Event');
  const body = await req.text();
  
  // Verify signature
  const expectedSignature = await createHMAC(body, WEBHOOK_SECRET);
  if (signature !== `sha256=${expectedSignature}`) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  const payload = JSON.parse(body);
  
  // Handle different events
  switch (event) {
    case 'quota.warning':
      await sendSlackAlert(`⚠️ AgentCache quota at ${payload.data.percent}%`);
      break;
      
    case 'quota.exceeded':
      await pauseAgents(); // Stop agents temporarily
      await sendSlackAlert('🚨 AgentCache quota exceeded!');
      break;
      
    case 'cache.hit':
      await updateDashboard({ hitRate: calculateHitRate() });
      break;
  }
  
  return new Response('OK', { status: 200 });
}

// Verify signature helper
async function createHMAC(data: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Webhook Management

**Get current webhook**:
```bash
curl https://agentcache.ai/api/webhooks \
  -H "X-API-Key: your_api_key"
```

**Test webhook**:
```bash
curl -X POST https://agentcache.ai/api/webhooks/test \
  -H "X-API-Key: your_api_key"
```

**Delete webhook**:
```bash
curl -X DELETE https://agentcache.ai/api/webhooks \
  -H "X-API-Key: your_api_key"
```

---

## 2. Kimi K2 Integration (Moonshot AI)

### Why Kimi K2?

Kimi K2 (Moonshot AI) offers:
- **200K+ token context window** (vs. GPT-4's 128K)
- **Exposed reasoning tokens** (visible "thinking" process)
- **Cost-effective** (~80% cheaper than GPT-4 for Chinese/English)
- **Deep reasoning** (similar to o1 but more transparent)

### Basic Usage

```typescript
// Already supported! Just use provider: 'moonshot'
const response = await agentcache.get({
  provider: 'moonshot',
  model: 'moonshot-v1-128k',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing' }
  ]
});
```

### Reasoning Token Caching (Coming in Phase 2)

**Concept**: Kimi K2 shows its "thinking" before answering. We can cache both:

```typescript
// Future API design
const response = await agentcache.get({
  provider: 'moonshot',
  model: 'moonshot-v1-128k',
  messages: [...],
  cache_reasoning: true,  // ← Cache reasoning tokens separately
  reasoning_ttl: 3600     // Cache reasoning for 1 hour
});

// Response includes:
{
  "hit": true,
  "response": "Quantum computing is...",
  "reasoning": {
    "cached": true,
    "tokens": 5000,
    "cost_saved": "$0.15",
    "thinking_steps": [
      "First, I need to understand the basics...",
      "Then, I'll explain superposition...",
      "Finally, I'll discuss applications..."
    ]
  }
}
```

### Long Context Caching

**Use case**: Agent needs to analyze entire codebase (100K+ tokens)

```typescript
// Register long context once
await agentcache.registerContext({
  context_id: 'codebase_v1',
  provider: 'moonshot',
  context_prefix: [
    { role: 'system', content: ENTIRE_CODEBASE }  // 150K tokens
  ],
  ttl: 86400  // Cache for 24 hours
});

// Every query reuses cached context
const response = await agentcache.get({
  context_id: 'codebase_v1',
  provider: 'moonshot',
  messages: [
    { role: 'user', content: 'Find the authentication logic' }
  ]
});

// Cost savings:
// - Without caching: 150K + 20 tokens = $4.50 per call
// - With caching: 20 tokens only = $0.01 per call
// - Savings: 99.8% per call
```

---

## 3. Agent-to-Agent Communication

### Use Case: Multi-Agent Orchestration

**Scenario**: Agent A caches new knowledge, Agent B needs to know

```typescript
// Agent A caches response
await agentcache.set({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...],
  response: 'New market insights...',
  metadata: {
    topic: 'market_analysis',
    timestamp: Date.now()
  }
});

// Webhook fires → JettyThunder receives 'cache.hit' event
// JettyThunder notifies Agent B via internal event bus
eventBus.emit('knowledge_updated', {
  topic: 'market_analysis',
  source: 'agent_a'
});

// Agent B proactively warms its cache
await agentcache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...],  // Similar query about market analysis
});
```

### Use Case: Quota Management

**Scenario**: Prevent agent runaway before it happens

```typescript
// Register webhook for quota.warning
await agentcache.registerWebhook({
  url: 'https://jettythunder.app/webhooks/agentcache',
  events: ['quota.warning', 'quota.exceeded']
});

// Webhook handler in JettyThunder
async function handleQuotaWarning(data) {
  if (data.percent >= 80) {
    // Throttle non-critical agents
    await throttleAgents({ priority: 'low', factor: 0.5 });
    
    // Send notification to admin
    await sendEmail({
      to: 'admin@jettythunder.app',
      subject: 'AgentCache quota at 80%',
      body: `Consider upgrading. Used: ${data.used}/${data.quota}`
    });
  }
  
  if (data.percent >= 90) {
    // More aggressive throttling
    await throttleAgents({ priority: 'medium', factor: 0.3 });
  }
}

async function handleQuotaExceeded(data) {
  // Pause all non-essential agents
  await pauseAgents({ essential: false });
  
  // Alert on-call engineer
  await pagerDuty.alert({
    severity: 'critical',
    message: 'AgentCache quota exceeded. Agents paused.'
  });
}
```

---

## 4. Webhook Security Best Practices

### 1. Always Verify Signatures

```typescript
// Bad: Trust all webhooks
app.post('/webhooks/agentcache', async (req) => {
  const payload = req.body;
  await handleWebhook(payload); // ❌ No verification!
});

// Good: Verify signature
app.post('/webhooks/agentcache', async (req) => {
  const signature = req.headers['x-agentcache-signature'];
  const body = await req.text();
  
  const expected = await createHMAC(body, WEBHOOK_SECRET);
  if (signature !== `sha256=${expected}`) {
    return res.status(401).send('Invalid signature');
  }
  
  await handleWebhook(JSON.parse(body)); // ✅ Verified!
});
```

### 2. Use HTTPS Only

```typescript
// Bad: HTTP webhook URL
await agentcache.registerWebhook({
  url: 'http://jettythunder.app/webhooks'  // ❌ Insecure!
});

// Good: HTTPS only
await agentcache.registerWebhook({
  url: 'https://jettythunder.app/webhooks'  // ✅ Encrypted
});
```

### 3. Implement Idempotency

```typescript
// Handle duplicate webhook deliveries
const processedWebhooks = new Set();

async function handleWebhook(payload) {
  const webhookId = `${payload.event}_${payload.timestamp}`;
  
  if (processedWebhooks.has(webhookId)) {
    console.log('Duplicate webhook, ignoring');
    return;
  }
  
  processedWebhooks.add(webhookId);
  
  // Process webhook
  await processEvent(payload);
  
  // Clean up old entries (after 1 hour)
  setTimeout(() => processedWebhooks.delete(webhookId), 3600000);
}
```

### 4. Timeout Protection

```typescript
// Webhook handler should be fast (<5 seconds)
app.post('/webhooks/agentcache', async (req) => {
  const payload = req.body;
  
  // Acknowledge receipt immediately
  res.status(200).send('OK');
  
  // Process asynchronously
  processWebhookAsync(payload).catch(err => {
    console.error('Webhook processing error:', err);
  });
});

async function processWebhookAsync(payload) {
  // Do slow work here (database writes, API calls, etc.)
  await updateDashboard(payload);
  await sendNotifications(payload);
}
```

---

## 5. Integration Examples

### Example 1: Real-Time Dashboard

```typescript
// JettyThunder dashboard component
export function CacheMetrics() {
  const [metrics, setMetrics] = useState({
    hitRate: 0,
    costSaved: '$0',
    quotaPercent: 0
  });
  
  useEffect(() => {
    // Poll stats API every 30 seconds
    const interval = setInterval(async () => {
      const stats = await fetch('/api/agentcache/stats').then(r => r.json());
      setMetrics({
        hitRate: stats.metrics.hit_rate,
        costSaved: stats.metrics.cost_saved,
        quotaPercent: stats.quota.usage_percent
      });
    }, 30000);
    
    // Also listen for webhook events via WebSocket
    const ws = new WebSocket('wss://jettythunder.app/ws');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.source === 'agentcache_webhook') {
        // Update metrics immediately
        setMetrics(prev => ({ ...prev, ...data.metrics }));
      }
    };
    
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);
  
  return (
    <div className="cache-metrics">
      <Metric label="Hit Rate" value={`${metrics.hitRate}%`} />
      <Metric label="Cost Saved" value={metrics.costSaved} />
      <MetricWithWarning 
        label="Quota Used" 
        value={`${metrics.quotaPercent}%`}
        warning={metrics.quotaPercent > 80}
      />
    </div>
  );
}
```

### Example 2: Auto-Scaling Based on Quota

```typescript
// Auto-scale agents based on AgentCache quota
async function handleQuotaWarning(data) {
  const quotaPercent = data.percent;
  
  if (quotaPercent >= 80 && quotaPercent < 90) {
    // Scale up AgentCache plan OR reduce agent parallelism
    await configureAgents({
      maxConcurrent: 5,  // Reduce from 10
      cacheAggressive: true
    });
  }
  
  if (quotaPercent >= 90) {
    // Emergency: Upgrade AgentCache plan automatically
    await upgradeAgentCachePlan('enterprise');
    
    // Or reduce to essential agents only
    await pauseAgents({ 
      exclude: ['critical_customer_support', 'payment_processing'] 
    });
  }
}
```

---

## 6. Testing Your Integration

### Step 1: Register Test Webhook

```bash
# Use webhook.site for testing
curl -X POST https://agentcache.ai/api/webhooks \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/YOUR_UNIQUE_ID",
    "events": ["quota.warning", "cache.hit"],
    "secret": "test_secret_123"
  }'
```

### Step 2: Trigger Test Event

```bash
curl -X POST https://agentcache.ai/api/webhooks/test \
  -H "X-API-Key: ac_demo_test123"
```

### Step 3: Verify Receipt

Check webhook.site to see the test payload:

```json
{
  "event": "webhook.test",
  "timestamp": "2025-01-11T10:50:00Z",
  "data": {
    "test": true,
    "message": "This is a test webhook from AgentCache.ai",
    "timestamp": "2025-01-11T10:50:00Z"
  }
}
```

### Step 4: Verify Signature

```typescript
// Your webhook handler
const receivedSignature = 'abc123...'; // From header
const expectedSignature = await createHMAC(body, 'test_secret_123');

assert(receivedSignature === `sha256=${expectedSignature}`);
```

---

## 7. Roadmap

### Phase 1.5 (This Week) ✅
- [x] Webhook registration API
- [x] Quota warning/exceeded events
- [x] Signature verification
- [x] Test endpoint

### Phase 2 (Next 2 Weeks)
- [ ] Context caching (Gemini-style)
- [ ] Kimi K2 reasoning token caching
- [ ] cache.hit / cache.miss events
- [ ] Anomaly detection events

### Phase 3 (Next 2 Months)
- [ ] Semantic similarity events
- [ ] Performance degradation alerts
- [ ] Webhook retry logic
- [ ] Webhook delivery dashboard

---

## Support

- **Webhook Issues**: webhook-support@agentcache.ai
- **Kimi K2 Questions**: moonshot-integration@agentcache.ai
- **Docs**: https://agentcache.ai/docs/webhooks

---

Built with ❤️ for the agent economy 🤖
