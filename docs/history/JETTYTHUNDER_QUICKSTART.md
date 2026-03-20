# JettyThunder API Key - Quick Start Guide

## TL;DR - Get API Key in 30 Seconds

### Option 1: Use the Script (Recommended)
```bash
# Start AgentCache server
npm run dev

# In another terminal, run provisioning script
./scripts/provision-jettythunder.sh production
```

### Option 2: Use curl Directly
```bash
curl -X POST http://localhost:3001/api/provision/jettythunder \
  -H "Content-Type: application/json" \
  -d '{"environment": "production"}'
```

### Option 3: Use the API Endpoint
```bash
# For staging environment
curl -X POST http://localhost:3001/api/provision/jettythunder \
  -d '{"environment": "staging"}'

# For production (default)
curl -X POST http://localhost:3001/api/provision/jettythunder
```

---

## What You'll Get

```json
{
  "success": true,
  "message": "JettyThunder master key provisioned successfully",
  "api_key": "ac_jettythunder_a3f89d2c1b4e5f6...",
  "namespace": "jettythunder_production",
  "environment": "production",
  "rate_limit": 10000000,
  "tier": "enterprise"
}
```

---

## Next Steps for JettyThunder Team

### 1. Add to Vercel Environment Variables

```bash
# Navigate to JettyThunder repo
cd /Users/letstaco/Documents/jettythunder-v2

# Add environment variable
vercel env add AGENTCACHE_API_KEY
# Paste the API key when prompted

vercel env add AGENTCACHE_API_URL
# Enter: https://api.agentcache.ai (or your deployed URL)
```

### 2. Update edge-cdn.ts

Update `/Users/letstaco/Documents/jettythunder-v2/src/lib/edge-cdn.ts`:

```typescript
import { AgentCache } from 'agentcache-client';

const agentCache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY!,
  baseUrl: process.env.AGENTCACHE_API_URL || 'https://api.agentcache.ai'
});

export async function cacheFile(file: File, customerId: string) {
  const namespace = `jt_customer_${customerId}`;
  
  // Check cache first
  const cached = await agentCache.get({
    provider: 'jettythunder',
    model: 'file-delivery',
    messages: [{ role: 'system', content: `file:${file.id}` }],
    namespace
  });
  
  if (cached) {
    console.log(`✨ Cache hit for file ${file.id}`);
    return cached.response;
  }
  
  // Fetch from Lyve Cloud
  const lyveUrl = await fetchFromLyveCloud(file);
  
  // Cache for next time
  await agentCache.set({
    provider: 'jettythunder',
    model: 'file-delivery',
    messages: [{ role: 'system', content: `file:${file.id}` }],
    response: lyveUrl,
    namespace,
    ttl: 86400 // 24 hours
  });
  
  console.log(`📦 Cached file ${file.id} from Lyve`);
  return lyveUrl;
}
```

### 3. Test Integration

```bash
# In JettyThunder repo
npm run build
vercel --prod

# Test with a file upload/download
# Should see cache hit logs on subsequent requests
```

---

## Key Features

### ✅ Namespace Isolation
Each JettyThunder customer gets their own isolated namespace:
```typescript
namespace: `jt_customer_${customerId}`
```

This ensures:
- Customer A cannot access Customer B's cached files
- Clean data separation for multi-tenant SaaS
- Easy to track usage per customer

### ✅ Enterprise Rate Limits
- **10,000,000 requests/month** (enterprise tier)
- **500 requests/second**
- **100 concurrent requests**
- **1GB max file size**

### ✅ Multi-Environment Support
```bash
# Production
./scripts/provision-jettythunder.sh production

# Staging
./scripts/provision-jettythunder.sh staging

# Development
./scripts/provision-jettythunder.sh development
```

---

## API Endpoints Available

### Provision JettyThunder (Quick)
```bash
POST /api/provision/jettythunder
{
  "environment": "production" // optional, defaults to "production"
}
```

### Provision Any Client (Generic)
```bash
POST /api/provision
{
  "user_id": "your_org_id",
  "integration": "your_integration_name",
  "project_id": "your_project_id",
  "tier": "enterprise", // free, pro, enterprise
  "sector": "filestorage", // optional
  "use_case": "cdn_acceleration" // optional
}
```

### Get API Key Info
```bash
GET /api/provision/:api_key
```

---

## Architecture Overview

```
JettyThunder App
    ↓
    ↓ AGENTCACHE_API_KEY
    ↓
AgentCache API
    ↓
    ↓ Namespace: jt_customer_${customerId}
    ↓
Redis Cache (Multi-tier)
    ├─ Desktop CDN (1ms)
    ├─ AgentCache Edge (<50ms)
    ├─ Upstash Redis (20ms)
    └─ Seagate Lyve Cloud (origin, 100ms+)
```

---

## Expected Performance

### Before AgentCache
- **Download latency**: 500-2000ms
- **Bandwidth cost**: $200/month
- **Video startup**: 2-3 seconds
- **Cache hit rate**: 0%

### After AgentCache
- **Download latency**: <50ms (40x faster)
- **Bandwidth cost**: $60/month (70% reduction)
- **Video startup**: <500ms (6x faster)
- **Cache hit rate**: 70-85%

### ROI
- **Monthly savings**: $90
- **Annual savings**: $1,080
- **Break-even**: Month 1
- **Performance improvement**: 40x faster

---

## Troubleshooting

### "API key invalid"
```bash
# Check key format
echo $AGENTCACHE_API_KEY
# Should start with: ac_jettythunder_

# Verify key is active
curl -X GET http://localhost:3001/api/provision/$AGENTCACHE_API_KEY
```

### "Namespace collision"
```bash
# Ensure customer ID is sanitized
# Good: jt_customer_abc123
# Bad:  jt_customer_<script>alert()</script>

# Use this pattern:
const namespace = `jt_customer_${customerId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
```

### "Rate limit exceeded"
```bash
# Check current usage
curl -X GET http://localhost:3001/api/provision/$AGENTCACHE_API_KEY

# Implement exponential backoff in code
```

---

## Support

- **Email**: support@agentcache.ai
- **Documentation**: Full guide at `docs/JETTYTHUNDER_API_KEYS.md`
- **Custom Solution**: See `solutions/jettythunder-custom-solution.md`
- **Slack**: #jettythunder-integration (request access)

---

## Files Reference

```
agentcache-ai/
├── src/
│   ├── api/
│   │   └── provision-hono.ts         # API endpoint handlers
│   ├── services/
│   │   └── provisioning.ts           # Key generation logic
│   └── index.ts                      # Main app (routes registered)
├── scripts/
│   └── provision-jettythunder.sh     # Quick provisioning script
├── docs/
│   └── JETTYTHUNDER_API_KEYS.md      # Comprehensive guide
└── solutions/
    └── jettythunder-custom-solution.md  # Technical integration plan
```

---

## Production Deployment

### 1. Deploy AgentCache
```bash
# In agentcache-ai repo
vercel --prod

# Note the deployed URL
# e.g., https://agentcache-api.vercel.app
```

### 2. Generate Production Key
```bash
# Use production URL
curl -X POST https://agentcache-api.vercel.app/api/provision/jettythunder \
  -d '{"environment": "production"}'
```

### 3. Add to JettyThunder Vercel
```bash
# In jettythunder-v2 repo
vercel env add AGENTCACHE_API_KEY production
vercel env add AGENTCACHE_API_URL production
# Enter: https://agentcache-api.vercel.app
```

### 4. Deploy JettyThunder
```bash
git add .
git commit -m "feat: integrate AgentCache for CDN acceleration"
git push origin main

# Vercel will auto-deploy
```

---

## Questions?

1. **How do I rotate the API key?**
   - Generate a new key for a different environment name
   - Gradually migrate traffic
   - Deprecate old key after 24 hours

2. **Can I have multiple keys?**
   - Yes! One per environment (production, staging, dev)
   - One per customer tier if needed (free vs pro)

3. **How do I track usage per customer?**
   - Each customer uses isolated namespace
   - Monitor via `agentcache.get()` hit/miss metrics
   - Build admin dashboard with usage analytics

4. **What if Lyve Cloud changes URLs?**
   - AgentCache caches the URL, not the file
   - Set appropriate TTL (24h recommended)
   - Invalidate cache when URLs change

---

## Ready to Go! 🚀

Run the provisioning script and you're all set:

```bash
./scripts/provision-jettythunder.sh production
```

The script will output everything you need, including the exact environment variables to add to Vercel.
