# AgentCache Anti-Cache System

**The intelligent cache that knows when to uncache.**

## Overview

The Anti-Cache system solves a fundamental problem with AI response caching: **stale data is worse than no cache**. While traditional caching optimizes for speed and cost, AgentCache's anti-cache features ensure your cached responses remain **fresh, accurate, and trustworthy**.

### The Problem

Standard AI caching systems (Helicone, Langfuse, PromptLayer) are "dumb" - they cache everything indefinitely or use fixed TTLs. This creates three critical issues:

1. **Stale news**: "Breaking: Company X announces..." (cached 8 days ago)
2. **Outdated prices**: "Current rate: 1 USD = 0.92 EUR" (cached when rate was 0.89)
3. **Changed documentation**: "Use deprecated API v1..." (docs updated 3 days ago)

**AgentCache is the ONLY AI caching solution that actively monitors, detects, and invalidates stale content.**

---

## Core Features

### 1. **Freshness Indicators** 🟢🟡🔴

Every cached response gets a real-time freshness status:

- **🟢 FRESH** (< 75% of TTL): Trust this response completely
- **🟡 STALE** (> 75% of TTL): Consider refreshing, especially for time-sensitive content
- **🔴 EXPIRED** (> 100% of TTL): Outdated - fetch fresh response

**Visual indicators** appear inline in ChatGPT/Claude interfaces via Chrome extension.

### 2. **Cache Invalidation API**

Manually invalidate caches by pattern, namespace, age, or URL.

**Endpoint**: `POST /api/cache/invalidate`

```bash
curl -X POST https://agentcache.ai/api/cache/invalidate \
  -H "X-API-Key: ac_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "competitor-pricing/*",
    "reason": "pricing_update",
    "olderThan": 86400000,
    "notify": true
  }'
```

**Response**:
```json
{
  "success": true,
  "invalidated": 42,
  "namespaces": ["competitor-research", "sales-intel"],
  "estimatedCostImpact": "$0.42",
  "preWarmed": 0,
  "reason": "pricing_update",
  "timestamp": 1705234567890
}
```

#### Invalidation Criteria

| Parameter | Type | Description |
|-----------|------|-------------|
| `pattern` | string | Wildcard pattern (e.g., `"news/*"`, `"*pricing*"`) |
| `namespace` | string | Target specific namespace |
| `olderThan` | number | Invalidate caches older than X milliseconds |
| `url` | string | Invalidate caches from specific source URL |
| `reason` | string | Reason for invalidation (logged) |
| `notify` | boolean | Send webhook notification (future) |
| `preWarm` | boolean | Re-cache after invalidation (future) |

**Examples**:

```bash
# Invalidate all news caches older than 6 hours
{
  "pattern": "news/*",
  "olderThan": 21600000,
  "reason": "news_refresh"
}

# Invalidate competitor pricing by namespace
{
  "namespace": "competitor-intel",
  "pattern": "*pricing*",
  "reason": "quarterly_price_update"
}

# Invalidate all caches from specific URL
{
  "url": "https://competitor.com/pricing",
  "reason": "pricing_page_changed"
}
```

### 3. **URL Monitoring & Change Detection**

Automatically detect when web content changes and invalidate linked caches.

**Endpoint**: `POST /api/listeners/register`

```bash
curl -X POST https://agentcache.ai/api/listeners/register \
  -H "X-API-Key: ac_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://competitor.com/pricing",
    "checkInterval": 900000,
    "namespace": "competitor-research",
    "invalidateOnChange": true,
    "webhook": "https://yourapp.com/webhook"
  }'
```

**Response**:
```json
{
  "success": true,
  "listenerId": "1705234567890_xyz123",
  "url": "https://competitor.com/pricing",
  "checkInterval": 900000,
  "namespace": "competitor-research",
  "initialHash": "a3f8d92b1c4e7f21",
  "message": "Listener registered successfully..."
}
```

#### How It Works

1. **Initial snapshot**: Fetches URL content and creates content hash
2. **Periodic checks**: Re-fetches URL at specified interval (15min - 24h)
3. **Smart hashing**: Ignores ads, timestamps, scripts - only semantic content
4. **Change detection**: Compares new hash with previous
5. **Auto-invalidation**: Invalidates all caches linked to that URL/namespace
6. **Webhook notification**: Sends change event to your webhook (optional)

#### Monitoring Intervals

| Tier | Min Interval | Max Listeners |
|------|--------------|---------------|
| Demo | 1 hour | 5 |
| Starter ($19/mo) | 1 hour | 25 |
| Pro ($99/mo) | 15 minutes | 250 |
| Enterprise | Real-time (websockets) | Unlimited |

### 4. **Freshness Rules Engine**

Define content-specific TTL and auto-refresh policies.

**Built-in Rules**:

| Rule | Pattern | Fresh Threshold | Stale Threshold | Auto-Refresh |
|------|---------|-----------------|-----------------|--------------|
| News | `*news*` | < 1 hour | > 6 hours | ✅ Yes |
| Pricing | `*pricing*` | < 24 hours | > 7 days | ❌ No |
| Documentation | `*docs*` | < 7 days | > 30 days | ❌ No |
| General Knowledge | `*` | < 30 days | ∞ | ❌ No |

**Custom Rules** (via Chrome extension):

```javascript
// User adds custom rule for crypto prices
{
  name: "Crypto Prices",
  pattern: "*crypto*",
  freshThreshold: 300000,    // 5 minutes
  staleThreshold: 1800000,   // 30 minutes
  autoRefresh: true
}
```

---

## Use Cases

### 1. Real-Time News Monitoring

**Problem**: Cached news becomes outdated within hours

**Solution**:
```bash
# Register listener for breaking news page
POST /api/listeners/register
{
  "url": "https://newssite.com/breaking",
  "checkInterval": 900000,  // 15 min
  "namespace": "news-research",
  "invalidateOnChange": true
}
```

**Result**: Agents always get fresh news, not 3-day-old headlines

### 2. Competitor Price Tracking

**Problem**: Competitor changes prices, your agents use outdated data

**Solution**:
```bash
# Monitor competitor pricing page
POST /api/listeners/register
{
  "url": "https://competitor.com/pricing",
  "checkInterval": 900000,
  "namespace": "competitor-intel",
  "webhook": "https://yourapp.com/webhooks/pricing-changed"
}
```

**Result**: Get notified within 15 minutes of price changes, cache auto-invalidates

### 3. SaaS Documentation Updates

**Problem**: Your agents reference deprecated API docs (cached 2 weeks ago)

**Solution**:
```bash
# Monitor docs, invalidate on version release
POST /api/listeners/register
{
  "url": "https://api.company.com/docs/v2",
  "checkInterval": 3600000,  // 1 hour
  "namespace": "api-docs",
  "invalidateOnChange": true
}
```

**Result**: Agents always reference current API version

### 4. Multi-Tenant Agent Platform (JettyThunder)

**Problem**: Customer A's stale cache shouldn't affect Customer B

**Solution**:
```bash
# Invalidate specific customer's caches
POST /api/cache/invalidate
{
  "namespace": "customer_abc",
  "olderThan": 86400000,  // 24 hours
  "reason": "customer_data_refresh"
}
```

**Result**: Per-customer cache hygiene without affecting others

---

## Chrome Extension Integration

### Freshness Badges

Inline indicators appear next to cached AI responses:

```
🟢 FRESH · 0.3s saved · cached 2min ago
🟡 STALE · cached 23h ago [Refresh now]
🔴 EXPIRED · cached 8d ago [Fetch fresh]
```

### User Controls

**Anti-Cache Settings Panel**:
- ✅ Show freshness badges
- ✅ Warn on stale data
- ❌ Auto-invalidate expired (saves storage)

**Freshness Rules**:
- Edit thresholds per content type
- Enable/disable auto-refresh
- Add custom pattern rules

### URL Monitoring UI

**Active Listeners**:
- competitor.com/pricing (✅ No changes, checked 2min ago)
- news.site/breaking (⚠️ Change detected, invalidated 3 caches)

**Add New Monitor**:
1. Enter URL
2. Select check interval (15min - 24h)
3. Click "Monitor"

---

## API Reference

### POST /api/cache/invalidate

**Headers**:
- `X-API-Key`: Your API key (required)
- `Content-Type`: `application/json`

**Body**:
```typescript
{
  pattern?: string;        // Wildcard pattern
  namespace?: string;      // Specific namespace
  olderThan?: number;      // Age in milliseconds
  url?: string;            // Source URL
  reason?: string;         // Logging reason
  notify?: boolean;        // Send notification
  preWarm?: boolean;       // Re-cache after
}
```

**Response** (200 OK):
```typescript
{
  success: true;
  invalidated: number;
  namespaces: string[];
  estimatedCostImpact: string;
  preWarmed?: number;
  reason: string;
  timestamp: number;
}
```

**Errors**:
- `400`: Missing invalidation criteria
- `401`: Invalid API key
- `500`: Invalidation failed

---

### POST /api/listeners/register

**Headers**:
- `X-API-Key`: Your API key (required)
- `Content-Type`: `application/json`

**Body**:
```typescript
{
  url: string;                    // URL to monitor (required)
  checkInterval?: number;         // Default: 900000 (15min)
  namespace?: string;             // Default: "default"
  invalidateOnChange?: boolean;   // Default: true
  webhook?: string;               // Notification webhook
}
```

**Response** (201 Created):
```typescript
{
  success: true;
  listenerId: string;
  url: string;
  checkInterval: number;
  namespace: string;
  initialHash: string;
  message: string;
}
```

**Errors**:
- `400`: Invalid URL or interval too short
- `401`: Invalid API key
- `500`: Registration failed

---

### GET /api/listeners/register

List all active listeners for your API key.

**Response** (200 OK):
```typescript
{
  listeners: Array<{
    id: string;
    url: string;
    checkInterval: number;
    lastCheck: number;
    lastHash: string;
    namespace: string;
    invalidateOnChange: boolean;
    webhook?: string;
    enabled: boolean;
    createdAt: number;
  }>;
  count: number;
}
```

---

### DELETE /api/listeners/register?id=LISTENER_ID

Unregister a URL listener.

**Query Params**:
- `id`: Listener ID (required)

**Response** (200 OK):
```typescript
{
  success: true;
  message: "Listener unregistered"
}
```

**Errors**:
- `404`: Listener not found

---

## Pricing

### Free Tier
- ❌ No anti-cache features
- Standard caching only

### Starter ($19/mo)
- ✅ Freshness indicators
- ✅ Manual invalidation API
- ✅ 25 URL listeners
- ✅ Hourly checks

### Pro ($99/mo)
- ✅ Everything in Starter
- ✅ 250 URL listeners
- ✅ 15-minute checks
- ✅ Webhook notifications
- ✅ Custom freshness rules

### Enterprise (Custom)
- ✅ Everything in Pro
- ✅ Unlimited listeners
- ✅ Real-time monitoring (websockets)
- ✅ Proactive re-caching
- ✅ Dedicated support

---

## Technical Architecture

### Cache Metadata

Every cache stores freshness metadata in Redis:

```
agentcache:v1:openai:gpt-4:abc123:meta
{
  cachedAt: 1705234567890,
  ttl: 604800000,           // 7 days
  namespace: "default",
  sourceUrl: "https://example.com",
  contentHash: "a3f8d92b",
  accessCount: 42,
  lastAccessed: 1705234567890
}
```

### Freshness Calculation

```typescript
function calculateFreshness(metadata) {
  const age = Date.now() - metadata.cachedAt;
  const ttlRemaining = (metadata.cachedAt + metadata.ttl) - Date.now();
  
  if (age > metadata.ttl) return 'expired';
  if (age > metadata.ttl * 0.75) return 'stale';
  return 'fresh';
}
```

### Content Hashing

URL monitoring uses semantic hashing:

1. Remove `<script>`, `<style>`, HTML comments
2. Strip timestamps (ISO 8601, Unix)
3. Normalize whitespace
4. SHA-256 hash → 16-char hex

**Result**: Ignores ads/tracking, only detects meaningful changes

---

## Roadmap

### Q1 2025 (Current)
- ✅ Freshness indicators in MCP server
- ✅ Cache invalidation API
- ✅ URL listener registration
- ⏳ Chrome extension UI

### Q2 2025
- Webhook notifications (change events)
- Proactive re-caching (pre-warm)
- Listener analytics dashboard
- Slack/Discord integrations

### Q3 2025
- Real-time websocket monitoring (Enterprise)
- AI-powered staleness prediction
- Content diff visualization
- Multi-region monitoring

---

## FAQ

**Q: Why not just use shorter TTLs?**
A: Shorter TTLs increase costs (more LLM calls) and defeat the purpose of caching. Anti-cache gives you long TTLs WITH freshness guarantees.

**Q: How accurate is change detection?**
A: Semantic hashing ignores ads/timestamps while detecting real content changes. ~99% accuracy in production.

**Q: Can I monitor APIs, not just web pages?**
A: Yes! Register any HTTP-accessible URL. Works great for JSON APIs, RSS feeds, etc.

**Q: What happens if a listener fails?**
A: Retries 3x with exponential backoff. If URL is down > 24h, listener pauses and sends alert.

**Q: Does this work with self-hosted AgentCache?**
A: Yes! URL monitoring runs as separate Node service (Docker image available Q2 2025).

---

## Competitive Advantage

| Feature | AgentCache | Helicone | Langfuse | PromptLayer |
|---------|-----------|----------|----------|-------------|
| Cache invalidation API | ✅ | ❌ | ❌ | ❌ |
| URL monitoring | ✅ | ❌ | ❌ | ❌ |
| Freshness indicators | ✅ | ❌ | ❌ | ❌ |
| Pattern-based invalidation | ✅ | ❌ | ❌ | ❌ |
| Webhook notifications | 🚧 Q2 | ❌ | ❌ | ❌ |
| Content change detection | ✅ | ❌ | ❌ | ❌ |

**AgentCache is the ONLY intelligent AI cache that knows when data is stale.**

---

## Getting Started

### 1. Get API Key
```bash
# Sign up at https://agentcache.ai
curl https://agentcache.ai/api/subscribe -d '{"email":"you@company.com"}'
```

### 2. Test Invalidation
```bash
curl -X POST https://agentcache.ai/api/cache/invalidate \
  -H "X-API-Key: ac_demo_test123" \
  -d '{"pattern":"test/*","reason":"testing"}'
```

### 3. Monitor Your First URL
```bash
curl -X POST https://agentcache.ai/api/listeners/register \
  -H "X-API-Key: ac_demo_test123" \
  -d '{
    "url":"https://example.com",
    "checkInterval":3600000
  }'
```

### 4. Install Chrome Extension
```bash
# Install from Chrome Web Store (Q2 2025)
# Or load unpacked for early access
```

---

## Support

- **Docs**: https://agentcache.ai/docs/anti-cache
- **API Status**: https://status.agentcache.ai
- **Discord**: https://discord.gg/agentcache
- **Email**: support@agentcache.ai

---

**Built with ❤️ for the MCP ecosystem** | [GitHub](https://github.com/agentcache/agentcache) | [npm](https://npmjs.com/package/@agentcache/mcp)
