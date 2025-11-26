# JettyThunder Customer Onboarding Playbook

## 🎯 Goal
Onboard JettyThunder as first AgentCache.ai customer with filestorage sector, achieving 60-70% bandwidth savings and $5K+/month cost reduction.

## 📋 Pre-Onboarding Checklist

### ✅ Infrastructure Ready
- [x] Database migrated with organizations support
- [x] Multi-tenant authentication implemented
- [x] File deduplication cache deployed
- [x] Desktop CDN evaluator ready
- [x] Portal frontend & backend APIs live
- [ ] **YOU NEED TO DO:** Set environment variables in Vercel
- [ ] **YOU NEED TO DO:** Test signup flow works

### 🔧 Vercel Environment Variables (CRITICAL)
**Must be set before onboarding:**
```
DATABASE_URL=postgresql://neondb_owner:npg_eplH4UbciL5k@ep-small-poetry-advcfzn7-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
UPSTASH_REDIS_REST_URL=https://frank-buzzard-35556.upstash.io
UPSTASH_REDIS_REST_TOKEN=AYrkAAIncDIxZjMxMDVkMzBkMzg0ZDMzOTBjYmJmZWU4NWZmMjVjZXAyMzU1NTY=
JWT_SECRET=YLxoiac+t2YH9hlv8rfVnY6D1PdemhsKma1pLNEQl7E=
NODE_ENV=production
```

Go to: https://vercel.com/xinetex/agentcache-ai/settings/environment-variables

---

## 📧 Phase 1: Initial Contact (5 minutes)

### Email Template
```
Subject: AgentCache.ai Customer Portal - JettyThunder Access

Hi [JettyThunder Contact],

Your AgentCache.ai customer portal is ready! 

🚀 Get Started:
1. Visit: https://agentcache-ai.vercel.app/portal/signup.html
2. Create your account (takes <3 minutes)
3. Copy your API key from the dashboard

📊 What You'll Get:
- 60-70% bandwidth savings on duplicate files
- $5K+/month cost reduction (Seagate Lyve egress)
- Real-time deduplication metrics
- Desktop CDN cache optimization

Your account will be pre-configured with:
✓ Storage namespace (file caching with deduplication)
✓ CDN namespace (desktop CDN acceleration)  
✓ Metadata namespace (file metadata caching)

Questions? Reply to this email.

Best,
[Your Name]
AgentCache.ai
```

---

## 👤 Phase 2: JettyThunder Signup (3-5 minutes)

### Expected Signup Flow

**Step 1: Account Creation**
- URL: `https://agentcache-ai.vercel.app/portal/signup.html`
- Email: `[their-email]@jettythunder.app`
- Password: [they choose, min 8 chars]

**Step 2: Organization Setup**
- Organization Name: `JettyThunder`
- Sector: `File Storage` ✓
- Description: "Seagate file management with desktop CDN component"

**Step 3: Auto-Provisioning**
System automatically creates:
```
Organization:
  - Name: JettyThunder
  - Slug: jettythunder
  - Sector: filestorage
  - Plan: starter (5 namespaces, 3 API keys)

Namespaces:
  1. storage (nodes: seagate_lyve_connector, file_dedup_cache)
  2. cdn (nodes: cdn_accelerator, desktop CDN support)
  3. metadata (nodes: metadata_cache, audit_log_cache)

API Key:
  - Format: ac_[64_hex_chars]
  - Shown ONCE on signup completion
  - Stored hashed (SHA-256) in database
```

**Step 4: Dashboard Redirect**
- Redirects to: `https://agentcache-ai.vercel.app/portal/dashboard.html`
- Shows: Organization name, 3 namespaces, 1 API key, empty metrics

---

## 🔑 Phase 3: API Key Setup (5 minutes)

### Integration Instructions to Send JettyThunder

**Quick Start:**
```javascript
// JettyThunder App Configuration
const AGENTCACHE_API_KEY = "ac_..."; // From dashboard
const AGENTCACHE_BASE_URL = "https://agentcache-ai.vercel.app";

// For file storage operations (with deduplication)
fetch(`${AGENTCACHE_BASE_URL}/api/cache/set`, {
  method: 'POST',
  headers: {
    'X-API-Key': AGENTCACHE_API_KEY,
    'X-Namespace': 'storage',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    key: 'firmware/v2.1.0.bin',
    value: fileContent,
    ttl: 604800 // 7 days
  })
});

// For desktop CDN operations
fetch(`${AGENTCACHE_BASE_URL}/api/cache/get`, {
  method: 'POST',
  headers: {
    'X-API-Key': AGENTCACHE_API_KEY,
    'X-Namespace': 'cdn',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    key: 'video/demo_4k.mp4'
  })
});
```

### Desktop CDN Integration (localhost:53777)
```javascript
// In JettyThunder Desktop App
import { analyzeDesktopCDNPerformance } from '@agentcache/desktop-cdn-evaluator';

// Report access patterns to optimize caching
const cdnMetrics = {
  accessHistory: [
    { timestamp: Date.now(), path: '/video/stream.mp4', size: 1024000 },
    // ... more access logs
  ]
};

const analysis = analyzeDesktopCDNPerformance(cdnMetrics);
// Returns: cache tier recommendations, optimal cache size, eviction priorities
```

---

## 📊 Phase 4: First Cache Hit (24 hours)

### What to Monitor

**In JettyThunder Dashboard:**
- Total Requests counter (should increment)
- Cache Hit Rate (starts at 0%, increases to 50%+ within 24h)
- Bandwidth Saved (shows GB saved via deduplication)
- Cost Savings (projects monthly savings)

**In Database (Admin View):**
```sql
-- Check their organization
SELECT * FROM organizations WHERE slug = 'jettythunder';

-- Check cache activity
SELECT 
  namespace_id,
  SUM(cache_requests) as total_requests,
  SUM(cache_hits) as hits,
  SUM(cache_misses) as misses
FROM organization_usage_metrics
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'jettythunder')
GROUP BY namespace_id;

-- Check dedup savings
SELECT * FROM namespaces WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'jettythunder');
```

### Expected Metrics After 24 Hours
- **Requests:** 100-1000+ (depends on usage)
- **Hit Rate:** 30-50% (cold start, improves to 80%+)
- **Dedup Rate:** 40-60% (firmware/drivers are highly duplicate)
- **Cost Savings:** $50-200/day projected

---

## 🎉 Phase 5: Success Validation (7 days)

### Week 1 KPIs

| Metric | Target | Status |
|--------|--------|--------|
| Signup completed | < 5 minutes | ⏳ |
| API key copied | ✓ | ⏳ |
| First cache request | < 24 hours | ⏳ |
| Hit rate | 50%+ | ⏳ |
| Dedup savings | 40%+ | ⏳ |
| Cost savings | $100+/week | ⏳ |
| User feedback | Positive | ⏳ |

### Follow-Up Email (Day 7)
```
Subject: JettyThunder - Week 1 Cache Performance Report

Hi [Name],

Great news! Here's your first week with AgentCache.ai:

📈 Performance:
- Cache Hit Rate: [X]%
- Total Requests: [X]
- Bandwidth Saved: [X] GB
- Duplicate Files Eliminated: [X]%

💰 Cost Savings:
- This Week: $[X]
- Monthly Projection: $[X]
- Annual Projection: $[X]

🚀 Next Steps:
1. Enable desktop CDN cache evaluation for additional 10-15% savings
2. Configure thumbnail_cache for faster media previews
3. Set up audit_log_cache for compliance tracking

Questions or want to optimize further? Let's schedule a call.

Best,
[Your Name]
```

---

## 🔧 Troubleshooting

### Issue: Signup fails
**Check:**
- Vercel environment variables set?
- Database connection working? (test with `node scripts/check-db-status.js`)
- Vercel function logs show errors?

**Fix:**
```bash
# Test locally first
cd /Users/letstaco/Documents/agentcache-ai
npm run dev
# Visit http://localhost:3000/portal/signup.html
```

### Issue: API key doesn't work
**Check:**
- Key format: `ac_` + 64 hex characters
- Headers included: `X-API-Key` and `X-Namespace`
- Namespace exists in database for their org

**Debug:**
```sql
-- Verify their API key exists
SELECT * FROM api_keys WHERE organization_id = (
  SELECT id FROM organizations WHERE slug = 'jettythunder'
);

-- Verify their namespaces
SELECT * FROM namespaces WHERE organization_id = (
  SELECT id FROM organizations WHERE slug = 'jettythunder'
);
```

### Issue: No metrics showing
**Check:**
- Cache requests actually hitting `/api/cache/*` endpoints?
- Organization usage metrics being recorded?
- Redis connection working?

**Debug:**
```bash
# Connect to Redis and check keys
redis-cli --tls -u redis://default:AYkUAAIncDFhNDQxOGFjZjZkN2M0MzI5OGI4MjZiYzBjOWFjNzA5Y3AxMzUwOTI@fluent-labrador-35092.upstash.io:6379

# Check for cache keys
KEYS dedup:*
KEYS cache:*
```

---

## 📝 Post-Onboarding

### Month 1 Goals
- [ ] 80%+ cache hit rate
- [ ] $5K+ monthly cost savings demonstrated
- [ ] Desktop CDN evaluation enabled
- [ ] Positive customer testimonial
- [ ] Case study written
- [ ] JettyThunder referral (potential)

### Expansion Opportunities
1. **Thumbnail Cache:** Pre-generate and cache video thumbnails
2. **Audit Log Cache:** Cache compliance/audit queries (SOC2/GDPR)
3. **Custom Nodes:** JettySpeed-specific cache optimization
4. **Professional Plan Upgrade:** 20 namespaces, 10 API keys, priority support

---

## ✅ Onboarding Complete Checklist

- [ ] Environment variables set in Vercel
- [ ] Signup flow tested with dummy account
- [ ] Invitation email sent to JettyThunder
- [ ] JettyThunder signup completed (< 5 min)
- [ ] API key copied to their app
- [ ] First cache request received (< 24h)
- [ ] Dashboard showing metrics
- [ ] Dedup savings tracking
- [ ] Week 1 follow-up scheduled
- [ ] Case study discussion scheduled

---

**Created:** 2025-11-26  
**Status:** Ready for Phase 8 execution  
**Owner:** You  
**Customer:** JettyThunder (first customer!)
