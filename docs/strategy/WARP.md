# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

**🚀 New Agent? Start here:** [AGENT_QUICKSTART.md](./AGENT_QUICKSTART.md) - 2-minute frictionless onboarding with executable commands.

## Project Overview

AgentCache.ai is an edge caching service for AI API calls that reduces LLM costs by 90% and improves response times 10x. The service sits between applications and AI providers (OpenAI, Anthropic, etc.) to cache identical prompts automatically.

**Current Status**: MVP - Beta Launch (January 2025)

## Architecture

### Dual Deployment Model

This project has **two separate backend implementations**:

1. **Vercel Edge Functions** (`/api/*.js`) - Production deployment
   - Edge-optimized serverless functions
   - Each endpoint is a separate file: `cache.js`, `health.js`, `subscribe.js`, `verify.js`, `admin-stats.js`
   - Uses `export const config = { runtime: 'edge' }` for Vercel Edge Runtime
   - Direct Upstash Redis REST API calls (no Redis client library)

2. **Hono Node Server** (`/src/index.ts`) - Development/alternative deployment
   - Node.js server using Hono framework
   - Uses ioredis client library
   - Can be compiled to `/dist` for local testing

**Important**: The `/api` directory is the **production system**. Changes should be made there for deployment.

### Tech Stack

- **Backend**: Hono (edge-compatible framework)
- **Cache Layer**: Upstash Redis (global edge)
- **Database**: Neon PostgreSQL (not yet fully integrated)
- **Deployment**: Vercel Edge Functions
- **Frontend**: Static HTML/CSS/JS in `/public`
- **Type Safety**: TypeScript (for `/src` only)

### Key Components

**Cache Key Generation**:
- Uses SHA-256 hash of `{ provider, model, messages, temperature }`
- Format: `agentcache:v1:{namespace}:{provider}:{model}:{hash}` (namespace optional)
- Ensures deterministic caching (same input = same key)
- Supports multi-tenant namespacing via `X-Cache-Namespace` header

**Authentication**:
- Demo keys: `ac_demo_*` (hardcoded, unlimited for testing)
- Live keys: `ac_live_*` (SHA-256 hash lookup in Redis)
- Key format validated with `startsWith('ac_')`

**API Endpoints**:
- `POST /api/cache/get` - Check and retrieve cached response
- `POST /api/cache/set` - Store AI response in cache
- `POST /api/cache/check` - Check if response is cached (with TTL)
- `GET /api/stats` - Real-time analytics (hit rate, savings, performance)
- `POST /api/subscribe` - Email waitlist signup with verification
- `POST /api/verify` - Email verification handler
- `GET /api/health` - Enhanced health check with Redis connectivity
- `GET /api/admin-stats` - Admin statistics (requires ADMIN_TOKEN)

## Common Commands

### Development

**No build/test commands are configured yet** - this is an MVP with minimal tooling.

To run the Hono development server (if needed):
```bash
# Compile TypeScript (if you have tsx)
pnpm tsx src/index.ts

# OR use the compiled output
node dist/index.js
```

### Deployment

**Primary method**: Push to GitHub triggers automatic Vercel deployment.

```bash
# Deploy to Vercel
git add .
git commit -m "your message"
git push origin main
```

Vercel automatically deploys:
- Static files from `/public`
- Serverless functions from `/api`

### Database Operations (Future)

```bash
# Generate database migrations (when DB is active)
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate

# Open Drizzle Studio
pnpm drizzle-kit studio
```

## Environment Variables

Required variables (see `.env.example`):

```bash
# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Database (Neon PostgreSQL - not fully integrated yet)
DATABASE_URL=postgresql://...

# Email (Resend or SendGrid)
RESEND_API_KEY=re_...
# OR
SENDGRID_API_KEY=SG...

# Admin access
ADMIN_TOKEN=your-secret-token

# Optional: Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## Code Architecture

### Cache Flow

1. **Cache Hit Path**:
   - Client sends request with API key + prompt details
   - Validate API key (demo or SHA-256 lookup)
   - Generate deterministic cache key
   - Check Redis for existing response
   - Return cached response with latency metrics

2. **Cache Miss Path**:
   - Client receives 404 "Cache miss"
   - Client calls their LLM provider directly
   - Client stores response via `/api/cache/set`
   - Response cached with configurable TTL (default 7 days)

### Email Verification Flow

1. User submits email via `/api/subscribe`
2. Generate UUID token, store in Redis with 48h TTL
3. Send verification email via Resend/SendGrid
4. User clicks link to `/api/verify?token=...`
5. Verify token, move email from `subscribers:pending` to `subscribers`
6. Optional Slack notification

### Quota System (Live Keys)

- Monthly quota stored in Redis: `usage:{hash}/monthlyQuota`
- Usage tracked in: `usage:{hash}:m:{YYYY-MM}`
- Increments on each request
- Returns 429 if quota exceeded

### Rate Limiting

- Per-API-key rate limiting to prevent runaway agents
- Demo keys: 100 requests/minute
- Live keys: 500 requests/minute
- Sliding window (1-minute buckets)
- Returns 429 with limit info when exceeded

### Namespace Support (Multi-Tenancy)

**Purpose**: Allows agent platforms to segment caching by customer/workflow

**Usage**:
```bash
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_live_xxx" \
  -H "X-Cache-Namespace: customer_abc" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**Benefits**:
- Isolate cache by customer (for JettyThunder.app multi-tenant use)
- Separate cache by agent type or workflow
- Track per-namespace analytics (coming soon)

### Analytics API

**Endpoint**: `GET /api/stats?period=24h&namespace=optional`

**Response**:
```json
{
  "period": "24h",
  "namespace": "default",
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
  },
  "performance": {
    "requests_per_day": 15420,
    "efficiency_score": 80.0,
    "cost_reduction_percent": 72.0
  }
}
```

**Use Cases**:
- Embed in JettyThunder.app dashboard
- Monitor agent performance
- Calculate ROI in real-time
- Alert on quota approaching limit

## Development Guidelines

### Working with the Production API

**When editing `/api` endpoints**:
- No TypeScript - use plain JavaScript
- Include `export const config = { runtime: 'edge' }`
- Use native `fetch()` for HTTP requests
- Use `crypto.subtle` for hashing (Web Crypto API)
- No Node.js-specific APIs (no `fs`, `path`, etc.)
- Use Upstash Redis REST API directly (not ioredis)

### Error Handling Pattern

All endpoints use consistent error responses:

```javascript
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store' 
    },
  });
}

// Usage
return json({ error: 'Message', details: err.message }, 400);
```

### Authentication Pattern

```javascript
async function auth(req) {
  const apiKey = req.headers.get('x-api-key') || 
                 req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) return { ok: false };
  if (apiKey.startsWith('ac_demo_')) return { ok: true, kind: 'demo' };
  // ... verify live keys via Redis hash lookup
}
```

### Redis Key Conventions

```
agentcache:v1:{provider}:{model}:{hash}  - Cached responses
key:{hash}/email                          - API key email lookup
usage:{hash}/monthlyQuota                 - Quota limit
usage:{hash}:m:{YYYY-MM}                  - Monthly usage counter
usage:{hash}                              - Hash with hits/misses counters
subscribers                               - Set of verified emails
subscribers:pending                       - Set of pending emails
waitlist                                  - Set of waitlist emails
subscriber:{email}                        - Hash of subscriber metadata
verify:{token}                            - Email verification tokens (48h TTL)
```

## Testing Approach

**No local testing** - all testing is done on Vercel deployments.

For API testing:
1. Deploy to Vercel
2. Use demo API key: `ac_demo_test123`
3. Test endpoints with curl/Postman

```bash
# Example: Test cache endpoint
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Important Notes

### MVP Limitations

- Database integration is incomplete (Drizzle ORM configured but not in use)
- No automated tests
- No CI/CD beyond Vercel auto-deploy
- Stripe integration planned but not implemented
- Python/Go SDKs are roadmap items

### Future Development

Per `LAUNCH_PLAN.md`:
- Q1 2025: User auth, Stripe integration, NPM package
- Q2 2025: Python SDK, Go SDK, usage dashboard
- Q3 2025: Self-hosted option, enterprise features

### Do Not

- Do NOT add localhost testing - it doesn't work with the edge runtime
- Do NOT use Node.js APIs in `/api` files
- Do NOT commit changes without testing on Vercel first
- Do NOT use TypeScript in `/api` directory
- Do NOT add complex build tooling without discussing with team

### Do

- Test all changes on Vercel deployments
- Keep `/api` and `/src` implementations in sync conceptually
- Maintain deterministic cache key generation
- Use consistent error response format
- Follow existing authentication patterns
- Document breaking changes to the caching API

## Domain

Primary domain: **agentcache.ai**
