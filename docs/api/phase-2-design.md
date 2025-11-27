# Phase 2: Real-Time Features Design

Technical design for webhooks and streaming API (Phase 2 of agent enablement).

## 1. Webhook System Architecture

### 1.1 Overview

Event-driven notification system allowing agents to subscribe to cache events without polling.

### 1.2 Event Types

**Core Events:**
- `cache.hit` - Cache hit occurred
- `cache.miss` - Cache miss, LLM was called
- `cache.invalidate` - Entry manually invalidated
- `cache.expired` - Entry expired due to TTL
- `cache.error` - Cache operation failed

**Pipeline Events:**
- `pipeline.created` - New pipeline created
- `pipeline.updated` - Pipeline config changed
- `pipeline.deleted` - Pipeline removed

**Compliance Events:**
- `compliance.phi_detected` - PHI detected in healthcare
- `compliance.pci_filtered` - PCI data filtered in finance
- `compliance.violation` - Compliance rule violated

### 1.3 Webhook Payload Format

```json
{
  "id": "evt_abc123def456",
  "type": "cache.hit",
  "timestamp": "2025-11-27T02:11:09.123Z",
  "api_version": "v1",
  "data": {
    "cache_key": "7f3d9e2a1b4c5e6f",
    "pipeline_id": "pipeline_abc123",
    "sector": "healthcare",
    "latency_ms": 35,
    "tokens_saved": 450,
    "compliance_validated": ["HIPAA"]
  },
  "metadata": {
    "user_id": "user_123",
    "namespace": "org:acme:team:marketing"
  }
}
```

### 1.4 Security

**HMAC Signature:**
```
X-AgentCache-Signature: sha256=abc123...
```

Computed as:
```python
signature = hmac.new(
    webhook_secret.encode(),
    msg=f"{timestamp}.{payload}".encode(),
    digestmod=hashlib.sha256
).hexdigest()
```

**Headers:**
```
X-AgentCache-Signature: sha256=abc123...
X-AgentCache-Event-Type: cache.hit
X-AgentCache-Event-ID: evt_abc123def456
X-AgentCache-Timestamp: 1638360000
```

### 1.5 Delivery Guarantees

**Retry Logic:**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 5 attempts
- Timeout: 10s per attempt
- Mark failed after 5 attempts

**Status Tracking:**
```json
{
  "webhook_id": "webhook_xyz789",
  "event_id": "evt_abc123",
  "status": "delivered",
  "attempts": 1,
  "last_attempt": "2025-11-27T02:11:09Z",
  "response_code": 200,
  "response_time_ms": 45
}
```

### 1.6 Database Schema

```sql
-- Webhooks table
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook events table (for retry queue)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMPTZ,
    next_attempt TIMESTAMPTZ,
    response_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_next_attempt ON webhook_events(next_attempt) WHERE status = 'pending';
```

### 1.7 API Endpoints

**Create Webhook:**
```
POST /api/webhooks
{
  "url": "https://myapp.com/webhooks",
  "events": ["cache.hit", "cache.miss"],
  "secret": "webhook_secret_123"
}
```

**List Webhooks:**
```
GET /api/webhooks
```

**Get Webhook:**
```
GET /api/webhooks/:webhook_id
```

**Update Webhook:**
```
PATCH /api/webhooks/:webhook_id
{
  "active": false
}
```

**Delete Webhook:**
```
DELETE /api/webhooks/:webhook_id
```

**Test Webhook:**
```
POST /api/webhooks/:webhook_id/test
```

**List Webhook Events:**
```
GET /api/webhooks/:webhook_id/events?limit=50&status=failed
```

### 1.8 Implementation (Vercel Serverless)

**Background Worker (Vercel Cron):**

```typescript
// api/cron/deliver-webhooks.ts
export default async function handler(req: Request) {
  // Run every minute
  const pendingEvents = await db.query(`
    SELECT * FROM webhook_events
    WHERE status = 'pending'
    AND next_attempt <= NOW()
    LIMIT 100
  `);

  for (const event of pendingEvents) {
    await deliverWebhookEvent(event);
  }
}

async function deliverWebhookEvent(event: WebhookEvent) {
  const webhook = await getWebhook(event.webhook_id);
  
  try {
    const signature = generateSignature(webhook.secret, event.payload);
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentCache-Signature': signature,
        'X-AgentCache-Event-Type': event.event_type,
        'X-AgentCache-Event-ID': event.id,
      },
      body: JSON.stringify(event.payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (response.ok) {
      await markEventDelivered(event.id, response.status);
    } else {
      await retryEvent(event);
    }
  } catch (error) {
    await retryEvent(event);
  }
}
```

**Vercel Cron Config:**
```json
{
  "crons": [
    {
      "path": "/api/cron/deliver-webhooks",
      "schedule": "* * * * *"
    }
  ]
}
```

---

## 2. Streaming API Architecture

### 2.1 Overview

Server-Sent Events (SSE) for real-time partial results, enabling agents to process data incrementally.

### 2.2 SSE Endpoint

**Endpoint:** `POST /api/cache/stream`

**Request:**
```json
{
  "prompt": "Analyze quarterly revenue trends",
  "stream": true,
  "sector": "datascience"
}
```

**Response:** `Content-Type: text/event-stream`

```
event: start
data: {"cache_key": "7f3d9e2a1b4c5e6f", "cache_hit": false}

event: chunk
data: {"content": "Analyzing Q1 revenue...", "tokens": 4}

event: chunk
data: {"content": "\nQ1 revenue increased by 15%", "tokens": 6}

event: metrics
data: {"latency_ms": 250, "tokens_processed": 10}

event: complete
data: {"result": "Full analysis text here", "total_tokens": 450, "cached": true}

event: end
data: {}
```

### 2.3 Event Types

- `start` - Stream started
- `chunk` - Partial content
- `metrics` - Intermediate metrics
- `error` - Error occurred
- `complete` - Final result
- `end` - Stream closed

### 2.4 Client Implementation

**Python:**
```python
import httpx

async with httpx.AsyncClient() as client:
    async with client.stream(
        'POST',
        'https://agentcache.ai/api/cache/stream',
        json={'prompt': 'Analyze data', 'stream': True},
        headers={'Authorization': f'Bearer {api_key}'},
        timeout=60.0
    ) as response:
        async for line in response.aiter_lines():
            if line.startswith('data: '):
                data = json.loads(line[6:])
                process_chunk(data)
```

**Node.js:**
```typescript
const response = await fetch('https://agentcache.ai/api/cache/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ prompt: 'Analyze data', stream: true }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      processChunk(data);
    }
  }
}
```

### 2.5 Batch Streaming

For multiple queries (e.g., analyzing 500 stocks):

**Endpoint:** `POST /api/cache/stream/batch`

**Request:**
```json
{
  "queries": [
    {"prompt": "Analyze AAPL", "context": {"symbol": "AAPL"}},
    {"prompt": "Analyze GOOGL", "context": {"symbol": "GOOGL"}},
    ...
  ],
  "batch_size": 50,
  "stream": true
}
```

**Response:**
```
event: batch_start
data: {"total_queries": 500, "batch_size": 50}

event: result
data: {"query_id": 0, "symbol": "AAPL", "result": "...", "cache_hit": true}

event: result
data: {"query_id": 1, "symbol": "GOOGL", "result": "...", "cache_hit": false}

event: batch_progress
data: {"completed": 50, "total": 500, "cache_hit_rate": 0.72}

event: batch_complete
data: {"total_completed": 500, "cache_hits": 360, "latency_ms": 8500}
```

### 2.6 Cache + Streaming Behavior

**On Cache Hit:**
- Return cached result immediately via single `complete` event
- No intermediate `chunk` events

**On Cache Miss:**
- Stream LLM response in real-time
- Cache final result
- Emit `chunk` events as tokens arrive

### 2.7 Implementation (Vercel Edge Functions)

```typescript
// api/cache/stream.ts
import { ReadableStream } from 'stream/web';

export const config = {
  runtime: 'edge', // Required for streaming
};

export default async function handler(req: Request) {
  const { prompt, stream, sector } = await req.json();
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send start event
      controller.enqueue(
        encoder.encode(`event: start\ndata: ${JSON.stringify({ cache_key: 'abc' })}\n\n`)
      );
      
      // Check cache
      const cached = await checkCache(prompt);
      
      if (cached) {
        // Cache hit - return immediately
        controller.enqueue(
          encoder.encode(`event: complete\ndata: ${JSON.stringify(cached)}\n\n`)
        );
        controller.enqueue(encoder.encode('event: end\ndata: {}\n\n'));
        controller.close();
        return;
      }
      
      // Cache miss - stream from LLM
      const llmStream = await callLLMStreaming(prompt);
      
      for await (const chunk of llmStream) {
        controller.enqueue(
          encoder.encode(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      
      controller.enqueue(encoder.encode('event: end\ndata: {}\n\n'));
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 2.8 Error Handling

**Timeout:**
```
event: error
data: {"error": "Stream timeout after 60s", "code": "TIMEOUT"}

event: end
data: {}
```

**Rate Limit:**
```
event: error
data: {"error": "Rate limit exceeded", "code": "RATE_LIMIT", "retry_after": 30}

event: end
data: {}
```

---

## 3. Implementation Timeline

### Week 5-6: Webhooks

**Day 1-2:** Database schema + API endpoints
**Day 3-4:** Delivery queue + retry logic
**Day 5:** HMAC signature verification
**Day 6:** Vercel Cron worker
**Day 7:** Testing + documentation

### Week 7-8: Streaming

**Day 1-2:** SSE endpoint + Edge function
**Day 3-4:** Batch streaming
**Day 5:** Client SDK updates (Python + Node.js)
**Day 6:** Cache + stream integration
**Day 7:** Testing + documentation

---

## 4. Testing Strategy

### Webhook Tests

1. Create webhook subscription
2. Trigger cache event
3. Verify delivery with correct signature
4. Test retry on failure (503)
5. Test rate limiting
6. Test event filtering

### Streaming Tests

1. Stream on cache miss
2. Immediate return on cache hit
3. Batch streaming with 100 queries
4. Timeout handling (60s)
5. Error mid-stream
6. Client reconnection

---

## 5. Success Metrics

### Webhooks

- Delivery success rate: >99%
- Median delivery latency: <500ms
- P99 delivery latency: <2s
- Retry success rate: >95%

### Streaming

- Time-to-first-byte: <100ms
- Stream throughput: >100 chunks/sec
- Error rate: <0.1%
- Client compatibility: Python 3.8+, Node 16+

---

**Status:** Design Complete ✅  
**Next Step:** Begin implementation (Week 5)
