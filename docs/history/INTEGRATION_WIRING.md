# AgentCache - Integration Wiring Guide

## 🔌 Complete System Integration

This document shows how all pieces connect together.

---

## 📁 Current File Structure

```
/api/
├── cache.js                      ✅ Main cache endpoint (GET/SET/CHECK)
├── cache/
│   └── invalidate.js            ✅ NEW - Cache invalidation API
├── listeners/
│   └── register.js              ✅ NEW - URL monitoring API
├── stats.js                      ✅ Analytics endpoint
├── health.js                     ✅ Health check
├── subscribe.js                  ✅ Email signup
├── verify.js                     ✅ Email verification
├── admin-stats.js               ✅ Admin dashboard
└── webhooks.js                  ✅ Webhook triggers

/src/mcp/
├── server.ts                     ✅ MCP server (4 tools)
├── security.ts                   ✅ Security middleware
└── anticache.ts                  ✅ NEW - Anti-cache library

/docs/
├── AgentCache.html               ✅ Original extension UI
├── AgentCache_v2_AntiCache.html ✅ NEW - Anti-cache UI
└── AgentCache_Pricing.html       ✅ NEW - Pricing + payments
```

---

## 🔗 Integration Points

### 1. **Cache Endpoint → Freshness Metadata**

**File**: `/api/cache.js`

**Current**: Stores only the cached response
**Needed**: Add metadata storage

#### Update `/set` endpoint (line 133-146):

```javascript
if (req.method === 'POST' && req.url.endsWith('/set')) {
  if (typeof response !== 'string') return json({ error: 'response (string) is required' }, 400);
  
  const today = new Date().toISOString().slice(0, 10);
  const metaKey = `${cacheKey}:meta`;
  
  const commands = [
    ["SETEX", cacheKey, ttl, response],
    // NEW: Store metadata
    ["HSET", metaKey, 
      "cachedAt", Date.now(),
      "ttl", ttl * 1000,
      "namespace", namespace || "default",
      "sourceUrl", req.headers.get('x-source-url') || "",
      "accessCount", 1,
      "lastAccessed", Date.now()
    ],
    ["EXPIRE", metaKey, ttl],
    ["INCR", `stats:global:misses:d:${today}`],
    ["EXPIRE", `stats:global:misses:d:${today}`, 60*60*24*7]
  ];
  
  if (authn.kind === 'live') {
    commands.push(["HINCRBY", `usage:${authn.hash}`, "misses", 1]);
  }
  
  await upstash(commands);
  return json({ success: true, key: cacheKey.slice(-16), ttl });
}
```

#### Update `/get` endpoint (line 148-170):

```javascript
if (req.method === 'POST' && req.url.endsWith('/get')) {
  const res = await fetch(`${getEnv().url}/get/${encodeURIComponent(cacheKey)}`, {
    headers: { Authorization: `Bearer ${getEnv().token}` },
    cache: 'no-store',
  });
  
  if (!res.ok) return json({ hit: false }, 404);
  const text = await res.text();
  
  // NEW: Get metadata and calculate freshness
  const metaKey = `${cacheKey}:meta`;
  const metaRes = await fetch(`${getEnv().url}/hgetall/${encodeURIComponent(metaKey)}`, {
    headers: { Authorization: `Bearer ${getEnv().token}` },
    cache: 'no-store'
  });
  
  let freshness = null;
  if (metaRes.ok) {
    const metaText = await metaRes.text();
    const metaData = JSON.parse(metaText);
    
    if (metaData.result && Array.isArray(metaData.result)) {
      // Parse HGETALL result [key, val, key, val, ...]
      const metadata = {};
      for (let i = 0; i < metaData.result.length; i += 2) {
        metadata[metaData.result[i]] = metaData.result[i + 1];
      }
      
      if (metadata.cachedAt) {
        const age = Date.now() - parseInt(metadata.cachedAt);
        const ttlMs = parseInt(metadata.ttl);
        const ttlRemaining = ttlMs - age;
        
        let status = 'fresh';
        if (age > ttlMs) status = 'expired';
        else if (age > ttlMs * 0.75) status = 'stale';
        
        freshness = {
          status,
          age,
          ttlRemaining: Math.max(0, ttlRemaining),
          freshnessScore: Math.round((Math.max(0, ttlRemaining) / ttlMs) * 100),
          cachedAt: parseInt(metadata.cachedAt)
        };
        
        // Update access stats
        await upstash([
          ["HINCRBY", metaKey, "accessCount", 1],
          ["HSET", metaKey, "lastAccessed", Date.now()]
        ]);
      }
    }
  }
  
  // Track global stats
  const today = new Date().toISOString().slice(0, 10);
  const estimatedTokens = Math.floor(text.length / 4);
  const commands = [
    ["INCR", `stats:global:hits:d:${today}`],
    ["EXPIRE", `stats:global:hits:d:${today}`, 60*60*24*7],
    ["INCRBY", `stats:global:tokens:d:${today}`, estimatedTokens],
    ["EXPIRE", `stats:global:tokens:d:${today}`, 60*60*24*7]
  ];
  
  if (authn.kind === 'live') {
    commands.push(["HINCRBY", `usage:${authn.hash}`, "hits", 1]);
  }
  
  await upstash(commands);
  
  return json({ 
    hit: !!text, 
    response: text,
    freshness  // NEW: Include freshness data
  });
}
```

---

### 2. **Stats Endpoint → Freshness Distribution**

**File**: `/api/stats.js`

**Add freshness distribution calculation**:

```javascript
// Add to stats response:
async function getFreshnessDistribution(namespace) {
  // Scan for all caches in namespace
  const scanRes = await fetch(
    `${UPSTASH_URL}/scan/0/match/agentcache:v1:${namespace}:*/count/1000`,
    { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }
  );
  const scanData = await scanRes.json();
  const cacheKeys = scanData.result?.[1] || [];
  
  let fresh = 0, stale = 0, expired = 0;
  
  for (const key of cacheKeys) {
    const metaKey = `${key}:meta`;
    const metaRes = await fetch(
      `${UPSTASH_URL}/hget/${encodeURIComponent(metaKey)}/cachedAt`,
      { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }
    );
    
    if (metaRes.ok) {
      const cachedAt = parseInt(await metaRes.text());
      const age = Date.now() - cachedAt;
      const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days default
      
      if (age > ttl) expired++;
      else if (age > ttl * 0.75) stale++;
      else fresh++;
    }
  }
  
  const total = fresh + stale + expired;
  return {
    fresh: { count: fresh, percent: total > 0 ? (fresh / total * 100).toFixed(1) : 0 },
    stale: { count: stale, percent: total > 0 ? (stale / total * 100).toFixed(1) : 0 },
    expired: { count: expired, percent: total > 0 ? (expired / total * 100).toFixed(1) : 0 },
    total
  };
}
```

---

### 3. **MCP Server → Anti-Cache Tools**

**File**: `/src/mcp/server.ts`

**Add two new tools**:

```typescript
// 1. Cache Invalidation Tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'agentcache_invalidate') {
    const args = request.params.arguments as {
      pattern?: string;
      namespace?: string;
      olderThan?: number;
      reason?: string;
    };
    
    const response = await fetch(`${API_BASE}/api/cache/invalidate`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    
    const data = await response.json();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }
  
  // 2. URL Listener Tool
  if (request.params.name === 'agentcache_register_listener') {
    const args = request.params.arguments as {
      url: string;
      checkInterval?: number;
      namespace?: string;
    };
    
    const response = await fetch(`${API_BASE}/api/listeners/register`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    
    const data = await response.json();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }
});

// Add tool definitions
const tools = [
  // ... existing tools ...
  {
    name: 'agentcache_invalidate',
    description: 'Invalidate cached responses by pattern, namespace, age, or URL',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Wildcard pattern (e.g., "news/*")' },
        namespace: { type: 'string', description: 'Target namespace' },
        olderThan: { type: 'number', description: 'Invalidate caches older than X milliseconds' },
        reason: { type: 'string', description: 'Reason for invalidation (for audit log)' }
      }
    }
  },
  {
    name: 'agentcache_register_listener',
    description: 'Register URL to monitor for content changes and auto-invalidate caches',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to monitor (required)' },
        checkInterval: { type: 'number', description: 'Check interval in milliseconds (default: 900000 = 15min)' },
        namespace: { type: 'string', description: 'Namespace to invalidate on change' }
      },
      required: ['url']
    }
  }
];
```

---

### 4. **Vercel Cron → URL Monitoring**

**File**: Create `/api/cron/check-listeners.js`

```javascript
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Verify cron secret (set in Vercel env vars)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  // Get all listeners
  const scanRes = await fetch(`${UPSTASH_URL}/scan/0/match/listener:*/count/1000`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const scanData = await scanRes.json();
  const listenerKeys = scanData.result?.[1] || [];
  
  let checked = 0;
  let changed = 0;
  const errors = [];
  
  for (const key of listenerKeys) {
    try {
      // Get listener data
      const getRes = await fetch(`${UPSTASH_URL}/hgetall/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      const getData = await getRes.json();
      
      if (!getData.result || getData.result.length === 0) continue;
      
      // Parse listener
      const listener = {};
      for (let i = 0; i < getData.result.length; i += 2) {
        listener[getData.result[i]] = getData.result[i + 1];
      }
      
      // Check if it's time to check
      const timeSinceLastCheck = Date.now() - parseInt(listener.lastCheck || '0');
      if (timeSinceLastCheck < parseInt(listener.checkInterval)) {
        continue;
      }
      
      // Fetch URL
      const urlRes = await fetch(listener.url, {
        headers: { 'User-Agent': 'AgentCache-Monitor/1.0 (+https://agentcache.ai)' }
      });
      const content = await urlRes.text();
      
      // Hash content (semantic hashing)
      const cleaned = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '')
        .replace(/\d{13}/g, '')
        .replace(/\d{10}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(cleaned));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
      
      checked++;
      
      // Compare with previous hash
      if (listener.lastHash && newHash !== listener.lastHash) {
        changed++;
        
        // Invalidate caches if configured
        if (listener.invalidateOnChange === 'true') {
          await fetch(`${req.url.origin}/api/cache/invalidate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'cron-internal'  // Use internal key
            },
            body: JSON.stringify({
              namespace: listener.namespace,
              reason: `url_change:${listener.url}`
            })
          });
        }
        
        // Send webhook if configured
        if (listener.webhook) {
          await fetch(listener.webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'url_changed',
              url: listener.url,
              namespace: listener.namespace,
              oldHash: listener.lastHash,
              newHash: newHash,
              timestamp: Date.now()
            })
          }).catch(() => {});
        }
      }
      
      // Update listener
      await fetch(`${UPSTASH_URL}/hset/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['lastCheck', Date.now(), 'lastHash', newHash])
      });
      
    } catch (err) {
      errors.push({ key, error: err.message });
    }
  }
  
  return new Response(JSON.stringify({
    success: true,
    checked,
    changed,
    errors: errors.length,
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Create**: `vercel.json` (in project root)

```json
{
  "crons": [{
    "path": "/api/cron/check-listeners",
    "schedule": "*/15 * * * *"
  }]
}
```

---

### 5. **Chrome Extension → API Integration**

**Manifest V3 structure**:

```
/extension/
├── manifest.json          # Extension config
├── background.js          # Service worker (API calls)
├── content.js             # Inject badges into pages
├── popup.html             # Main UI (from AgentCache_v2_AntiCache.html)
├── popup.js               # Popup logic
└── pricing.html           # Pricing page (from AgentCache_Pricing.html)
```

**API Integration** (`background.js`):

```javascript
// API configuration
const API_BASE = 'https://agentcache.ai';
let apiKey = null;

// Load API key from storage
chrome.storage.sync.get(['apiKey'], (result) => {
  apiKey = result.apiKey;
});

// Get cached response
async function checkCache(provider, model, messages) {
  const response = await fetch(`${API_BASE}/api/cache/get`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ provider, model, messages })
  });
  
  return response.json();
}

// Invalidate caches
async function invalidateCache(pattern, namespace) {
  const response = await fetch(`${API_BASE}/api/cache/invalidate`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pattern, namespace, reason: 'manual' })
  });
  
  return response.json();
}

// Register URL listener
async function registerListener(url, checkInterval, namespace) {
  const response = await fetch(`${API_BASE}/api/listeners/register`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url, checkInterval, namespace })
  });
  
  return response.json();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkCache') {
    checkCache(request.provider, request.model, request.messages)
      .then(sendResponse);
    return true;
  }
  
  if (request.action === 'invalidate') {
    invalidateCache(request.pattern, request.namespace)
      .then(sendResponse);
    return true;
  }
  
  if (request.action === 'registerListener') {
    registerListener(request.url, request.checkInterval, request.namespace)
      .then(sendResponse);
    return true;
  }
});
```

---

## 🚀 Deployment Checklist

### Phase 1: API Updates (30 minutes)
- [ ] Update `/api/cache.js` with metadata storage (lines 136-145)
- [ ] Update `/api/cache.js` with freshness calculation (lines 148-170)
- [ ] Create `/api/cron/check-listeners.js`
- [ ] Create `vercel.json` with cron config
- [ ] Add `CRON_SECRET` environment variable in Vercel

### Phase 2: Testing (15 minutes)
- [ ] Run `./test-anticache.sh` to test invalidation API
- [ ] Test listener registration with curl
- [ ] Deploy to Vercel and test freshness in cache responses
- [ ] Verify cron job runs (check Vercel logs after 15 min)

### Phase 3: MCP Server Updates (20 minutes)
- [ ] Add invalidation tool to `/src/mcp/server.ts`
- [ ] Add listener registration tool to `/src/mcp/server.ts`
- [ ] Rebuild MCP server: `pnpm run mcp:build`
- [ ] Test with Claude Desktop config

### Phase 4: Chrome Extension (Later)
- [ ] Create extension folder structure
- [ ] Convert HTML mockups to extension pages
- [ ] Implement background service worker
- [ ] Test locally with Chrome DevTools
- [ ] Submit to Chrome Web Store

---

## 📊 Testing Commands

```bash
# Test cache with freshness
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_demo_test123" \
  -d '{"provider":"openai","model":"gpt-4","messages":[{"role":"user","content":"test"}]}'

# Expected response includes freshness:
# {
#   "hit": true,
#   "response": "...",
#   "freshness": {
#     "status": "fresh",
#     "age": 5000,
#     "ttlRemaining": 604795000,
#     "freshnessScore": 99
#   }
# }

# Test invalidation
curl -X POST https://agentcache.ai/api/cache/invalidate \
  -H "X-API-Key: ac_demo_test123" \
  -d '{"pattern":"test/*","reason":"testing"}'

# Test listener registration
curl -X POST https://agentcache.ai/api/listeners/register \
  -H "X-API-Key: ac_demo_test123" \
  -d '{"url":"https://example.com","checkInterval":3600000}'

# List listeners
curl https://agentcache.ai/api/listeners/register \
  -H "X-API-Key: ac_demo_test123"
```

---

## 🔐 Environment Variables Needed

Add to Vercel:

```bash
# Existing
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
DATABASE_URL=postgresql://...
RESEND_API_KEY=re_...
ADMIN_TOKEN=...

# NEW - For cron job
CRON_SECRET=<generate-random-secret>  # Generate with: openssl rand -hex 32
```

---

## 📝 Next Actions

1. **Today**: Update `/api/cache.js` with metadata
2. **Today**: Create `/api/cron/check-listeners.js`
3. **Today**: Deploy to Vercel
4. **This week**: Test all endpoints
5. **Next week**: Build Chrome extension

---

**You're ready to wire everything up and go live! 🚀**
