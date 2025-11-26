# AgentCache Robotics API - Quick Reference

## 🚀 Quick Start

### Prerequisites
- AgentCache API key (get one at https://agentcache.ai/login)
- Demo key for testing: `ac_demo_test123`

---

## API Endpoints

### 1. Cache Invalidation

**Endpoint:** `POST /api/cache/invalidate`

**Purpose:** Invalidate cached responses when data becomes stale

**Headers:**
```
X-API-Key: YOUR_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "pattern": "navigation/*",     // Optional: wildcard pattern
  "namespace": "warehouse",      // Optional: specific namespace
  "olderThan": 3600000,          // Optional: age in milliseconds
  "url": "https://api.com/data", // Optional: source URL
  "reason": "obstacle_detected"  // Optional: audit reason
}
```

**Response:**
```json
{
  "success": true,
  "invalidated": 42,
  "namespaces": ["warehouse", "fleet-1"],
  "estimatedCostImpact": "$0.42",
  "reason": "obstacle_detected",
  "timestamp": 1732305605000
}
```

**Use Cases:**
- Robotics fleet invalidates navigation when obstacles detected
- Clear competitor pricing when changes detected
- Invalidate time-sensitive data (weather, traffic, stocks)

---

### 2. Register URL Listener

**Endpoint:** `POST /api/listeners/register`

**Purpose:** Monitor URLs for content changes and auto-invalidate caches

**Request Body:**
```json
{
  "url": "https://competitor.com/pricing",  // Required
  "checkInterval": 900000,                   // Optional: 15min default
  "namespace": "pricing",                    // Optional: "default"
  "invalidateOnChange": true,                // Optional: true default
  "webhook": "https://your.app/notify"       // Optional
}
```

**Response:**
```json
{
  "success": true,
  "listenerId": "1732305605_abc123def",
  "url": "https://competitor.com/pricing",
  "checkInterval": 900000,
  "namespace": "pricing",
  "initialHash": "a1b2c3d4e5f6",
  "message": "Listener registered successfully..."
}
```

---

### 3. List URL Listeners

**Endpoint:** `GET /api/listeners/register`

**Response:**
```json
{
  "listeners": [
    {
      "id": "1732305605_abc123def",
      "url": "https://competitor.com/pricing",
      "checkInterval": "900000",
      "lastCheck": "1732305605000",
      "lastHash": "a1b2c3d4e5f6",
      "namespace": "pricing",
      "enabled": "true"
    }
  ],
  "count": 1
}
```

---

### 4. Unregister Listener

**Endpoint:** `DELETE /api/listeners/register?id=LISTENER_ID`

**Response:**
```json
{
  "success": true,
  "message": "Listener unregistered"
}
```

---

## MCP Tools (Claude Desktop)

### 1. `agentcache_invalidate`

**Description:** Invalidate cached responses programmatically

**Parameters:**
- `pattern` (string, optional): Wildcard pattern (e.g., `"navigation/*"`)
- `namespace` (string, optional): Target namespace
- `olderThan` (number, optional): Invalidate caches older than X ms
- `url` (string, optional): Invalidate caches from specific URL
- `reason` (string, optional): Audit log reason

**Example:**
```
Use agentcache_invalidate to clear all navigation caches
with pattern "navigation/*" and reason "obstacle_detected"
```

---

### 2. `agentcache_register_listener`

**Description:** Register URL for automatic monitoring

**Parameters:**
- `url` (string, required): URL to monitor
- `checkInterval` (number, optional): Check interval in ms (default: 900000)
- `namespace` (string, optional): Namespace to invalidate (default: "default")
- `invalidateOnChange` (boolean, optional): Auto-invalidate flag (default: true)
- `webhook` (string, optional): Webhook URL for notifications

**Example:**
```
Use agentcache_register_listener to monitor "https://competitor.com/pricing"
with checkInterval 3600000 and namespace "pricing"
```

---

## Robotics Use Case Example

### Scenario: Warehouse Robot Fleet

**Setup:**
```bash
# 1. Register obstacle detection API as listener
curl -X POST https://agentcache.ai/api/listeners/register \
  -H "X-API-Key: YOUR_KEY" \
  -d '{
    "url": "https://warehouse-sensors.com/api/obstacles",
    "checkInterval": 900000,
    "namespace": "navigation"
  }'
```

**Background Process:**
- Cron job checks sensor API every 15 minutes
- On content change → auto-invalidates `navigation` namespace

**Manual Invalidation:**
```bash
# 2. If obstacle detected immediately, invalidate manually
curl -X POST https://agentcache.ai/api/cache/invalidate \
  -H "X-API-Key: YOUR_KEY" \
  -d '{
    "pattern": "navigation/*",
    "reason": "obstacle_detected_at_aisle_5"
  }'
```

**Benefits:**
- First robot caches navigation solution
- Fleet reuses → **90% cost savings, 40x faster**
- On obstacle → instant cache invalidation
- All robots get fresh navigation on next request

---

## Environment Variables (Vercel)

```bash
# Required for cron job authentication
CRON_SECRET=<openssl rand -hex 32>

# Existing (already configured)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Rate Limits

| Tier | Check Interval | Max Listeners |
|------|----------------|---------------|
| Demo | 1 hour minimum | 5 |
| Live | 15 min minimum | 100 |

---

## Cron Schedule

- **Frequency:** Every 15 minutes (`*/15 * * * *`)
- **Endpoint:** `/api/cron/check-listeners`
- **Authentication:** Bearer token via `CRON_SECRET`
- **Timeout:** 60 seconds (Vercel limit)

---

## Testing Commands

```bash
# Test invalidation
curl -X POST https://agentcache.ai/api/cache/invalidate \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{"pattern":"test/*","reason":"testing"}'

# Test listener registration
curl -X POST https://agentcache.ai/api/listeners/register \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","checkInterval":3600000}'

# List listeners
curl https://agentcache.ai/api/listeners/register \
  -H "X-API-Key: ac_demo_test123"

# Delete listener
curl -X DELETE "https://agentcache.ai/api/listeners/register?id=LISTENER_ID" \
  -H "X-API-Key: ac_demo_test123"
```

---

## Error Codes

| Code | Error | Solution |
|------|-------|----------|
| 400 | Missing invalidation criterion | Provide at least one: pattern, namespace, olderThan, or url |
| 400 | Invalid URL format | Check URL is valid (https://...) |
| 401 | Invalid API key | Check X-API-Key header |
| 429 | Rate limit exceeded | Wait before next request |

---

## Next Steps

1. Get an API Key: https://agentcache.ai/login
2. Test Invalidation: run the curl commands above
3. Set Up MCP: configure Claude Desktop per our docs
4. Monitor Cron: check Vercel logs after deployment
5. Scale: contact support for higher limits
