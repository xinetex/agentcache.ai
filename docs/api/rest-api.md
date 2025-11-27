# REST API Reference

Complete reference for AgentCache REST API endpoints.

## Base URL

```
https://agentcache.ai
```

## Authentication

All requests require a Bearer token in the Authorization header:

```http
Authorization: Bearer sk_live_your_api_key_here
```

Get your API key from [agentcache.ai/dashboard](https://agentcache.ai/dashboard).

---

## Cache Endpoints

### Query Cache

Query the cache or populate it if not found.

**Endpoint:** `POST /api/cache/query`

**Request Body:**
```json
{
  "prompt": "string",
  "context": {
    "key": "value"
  },
  "metadata": {
    "key": "value"
  },
  "ttl": 3600,
  "sector": "healthcare",
  "compliance": ["HIPAA", "HITECH"],
  "namespace": "org:acme:team:marketing",
  "invalidate_on": ["inventory_change", "price_update"]
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | The query prompt to cache/retrieve |
| `context` | object | No | Additional context for the query |
| `metadata` | object | No | Custom metadata to attach |
| `ttl` | integer | No | Time-to-live in seconds (default: sector-specific) |
| `sector` | enum | No | Market sector (healthcare, finance, etc.) |
| `compliance` | array[enum] | No | Required compliance frameworks |
| `namespace` | string | No | Namespace for multi-tenant isolation |
| `invalidate_on` | array[string] | No | Events that should invalidate this entry |

**Response:** `200 OK`
```json
{
  "cache_hit": true,
  "result": "HIPAA stands for Health Insurance Portability and Accountability Act...",
  "metadata": {
    "source": "cache",
    "node_id": "llm_cache_001"
  },
  "metrics": {
    "hit_rate": 0.88,
    "latency_ms": 35,
    "savings_usd": 0.002,
    "tokens_saved": 450
  },
  "cache_key": "7f3d9e2a1b4c5e6f",
  "expires_at": "2025-11-28T02:11:09Z",
  "compliance_validated": ["HIPAA", "HITECH"]
}
```

**Error Responses:**

- `400` - Invalid request parameters
- `401` - Invalid API key
- `429` - Rate limit exceeded
- `500` - Internal server error

**Example:**

```bash
curl -X POST https://agentcache.ai/api/cache/query \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is HIPAA compliance?",
    "sector": "healthcare",
    "compliance": ["HIPAA"]
  }'
```

---

### Invalidate Cache Entry

Manually invalidate a cache entry.

**Endpoint:** `DELETE /api/cache/invalidate/:cache_key`

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cache_key` | string | Yes | The cache key to invalidate |

**Response:** `200 OK`
```json
{
  "success": true,
  "cache_key": "7f3d9e2a1b4c5e6f"
}
```

**Example:**

```bash
curl -X DELETE https://agentcache.ai/api/cache/invalidate/7f3d9e2a1b4c5e6f \
  -H "Authorization: Bearer sk_live_..."
```

---

## Pipeline Endpoints

### Get Pipeline Configuration

Retrieve pipeline configuration by ID.

**Endpoint:** `GET /api/pipelines/:pipeline_id`

**Response:** `200 OK`
```json
{
  "id": "pipeline_abc123",
  "name": "HIPAA Healthcare Pipeline",
  "sector": "healthcare",
  "description": "HIPAA-compliant medical AI caching",
  "nodes": [
    {
      "type": "llm_cache",
      "position": { "x": 100, "y": 100 },
      "config": {
        "model": "gpt-4",
        "ttl": 3600
      }
    },
    {
      "type": "phi_filter",
      "position": { "x": 300, "y": 100 },
      "config": {
        "redact_phi": true
      }
    }
  ],
  "edges": [
    {
      "source": "node_1",
      "target": "node_2",
      "label": "PHI detected"
    }
  ],
  "compliance": ["HIPAA", "HITECH"],
  "tier": "advanced"
}
```

**Example:**

```bash
curl https://agentcache.ai/api/pipelines/pipeline_abc123 \
  -H "Authorization: Bearer sk_live_..."
```

---

### List Pipelines

List all pipelines for authenticated user.

**Endpoint:** `GET /api/pipelines`

**Query Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sector` | enum | No | Filter by sector |
| `compliance` | string | No | Filter by compliance framework |
| `limit` | integer | No | Results per page (default: 20, max: 100) |
| `offset` | integer | No | Pagination offset |

**Response:** `200 OK`
```json
{
  "pipelines": [
    {
      "id": "pipeline_abc123",
      "name": "HIPAA Healthcare Pipeline",
      "sector": "healthcare",
      "created_at": "2025-11-01T00:00:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

## Webhook Endpoints

### Create Webhook

Register a webhook for event notifications.

**Endpoint:** `POST /api/webhooks`

**Request Body:**
```json
{
  "url": "https://myapp.com/webhooks",
  "events": ["cache.hit", "cache.miss", "cache.invalidate"],
  "secret": "webhook_secret_123",
  "active": true
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Webhook delivery URL (must be HTTPS) |
| `events` | array[string] | Yes | Event types to subscribe to |
| `secret` | string | No | Secret for HMAC signature verification |
| `active` | boolean | No | Whether webhook is active (default: true) |

**Event Types:**
- `cache.hit` - Cache hit occurred
- `cache.miss` - Cache miss occurred
- `cache.invalidate` - Cache entry invalidated
- `pipeline.created` - New pipeline created
- `pipeline.updated` - Pipeline configuration updated

**Response:** `201 Created`
```json
{
  "id": "webhook_xyz789",
  "url": "https://myapp.com/webhooks",
  "events": ["cache.hit", "cache.miss"],
  "active": true,
  "created_at": "2025-11-27T02:11:09Z"
}
```

**Webhook Payload:**

When an event occurs, AgentCache sends a POST request to your webhook URL:

```json
{
  "id": "evt_abc123",
  "type": "cache.hit",
  "timestamp": "2025-11-27T02:11:09Z",
  "data": {
    "cache_key": "7f3d9e2a1b4c5e6f",
    "pipeline_id": "pipeline_abc123",
    "latency_ms": 35
  },
  "pipeline_id": "pipeline_abc123"
}
```

Headers include HMAC signature for verification:
```
X-AgentCache-Signature: sha256=abc123...
X-AgentCache-Event-Type: cache.hit
```

**Example:**

```bash
curl -X POST https://agentcache.ai/api/webhooks \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://myapp.com/webhooks",
    "events": ["cache.hit", "cache.miss"],
    "secret": "webhook_secret_123"
  }'
```

---

### List Webhooks

Get all webhooks for authenticated user.

**Endpoint:** `GET /api/webhooks`

**Response:** `200 OK`
```json
{
  "webhooks": [
    {
      "id": "webhook_xyz789",
      "url": "https://myapp.com/webhooks",
      "events": ["cache.hit", "cache.miss"],
      "active": true,
      "created_at": "2025-11-27T02:11:09Z"
    }
  ]
}
```

---

### Delete Webhook

Delete a webhook subscription.

**Endpoint:** `DELETE /api/webhooks/:webhook_id`

**Response:** `200 OK`
```json
{
  "success": true,
  "webhook_id": "webhook_xyz789"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "status_code": 400,
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Rate Limit Headers

Rate limit info is returned in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1638360000
Retry-After: 60
```

---

## Pagination

List endpoints support cursor-based pagination:

**Request:**
```
GET /api/pipelines?limit=20&offset=0
```

**Response:**
```json
{
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```

---

## Versioning

The API version is included in the URL:

```
https://agentcache.ai/v1/api/cache/query
```

Current version: **v1**

Breaking changes will result in a new version. We'll support old versions for at least 12 months after deprecation.

---

## SDKs

We recommend using official SDKs for easier integration:

- [Python SDK](./python-sdk.md)
- [Node.js SDK](./nodejs-sdk.md)

---

**Next Steps:**
- Explore [sector examples](./examples/)
- Learn about [webhooks](./webhooks.md)
- Review [compliance guide](./compliance.md)
