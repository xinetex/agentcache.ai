# AgentCache ↔ JettyThunder Integration Guide

Complete guide for connecting the two systems to enable automatic storage provisioning and JettySpeed uploads.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      USER SIGNS UP                            │
│                    (AgentCache.ai)                            │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│              AgentCache Backend                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  POST /api/webhooks/jettythunder/provision             │  │
│  │  • Receives: user_id, email, tier                      │  │
│  │  • Checks Redis cache (avoid duplicate provision)      │  │
│  │  • Calls JettyThunder API                              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │ HTTP POST with webhook secret
                   ▼
┌──────────────────────────────────────────────────────────────┐
│              JettyThunder Backend                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  POST /api/agentcache/provision                        │  │
│  │  • Validates webhook secret                            │  │
│  │  • Creates storage account in Neon DB                  │  │
│  │  • Generates API key + secret                          │  │
│  │  • Sets up S3 prefix (users/{user_id})                 │  │
│  │  • Returns credentials                                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  AgentCache caches  │
         │  credentials in     │
         │  Redis (30 days)    │
         └─────────────────────┘
```

---

## Prerequisites

### AgentCache Side
- ✅ Neon PostgreSQL database (for JettySpeed edges)
- ✅ Upstash Redis (for caching)
- ✅ Vercel deployment
- ✅ JettySpeed API endpoints (already built)

### JettyThunder Side
- ✅ Neon PostgreSQL database (for account provisioning)
- ✅ Seagate Lyve Cloud S3 credentials
- ✅ Node.js/Express server
- ✅ Drizzle ORM setup

---

## Setup Instructions

### Step 1: Configure Environment Variables

#### AgentCache `.env` (add these):
```bash
# JettyThunder Integration
JETTYTHUNDER_API_URL=https://jettythunder.app  # Production
# JETTYTHUNDER_API_URL=http://localhost:3001    # Development
JETTYTHUNDER_WEBHOOK_SECRET=your_shared_secret_here_change_me

# Internal webhook secret (for AgentCache → JettyThunder calls)
INTERNAL_WEBHOOK_SECRET=another_secret_for_internal_calls
```

#### JettyThunder `.env` (add these):
```bash
# AgentCache Integration
AGENTCACHE_WEBHOOK_SECRET=your_shared_secret_here_change_me  # Must match AgentCache's JETTYTHUNDER_WEBHOOK_SECRET

# Lyve Cloud S3
LYVE_BUCKET_NAME=agentcache-assets
LYVE_ACCESS_KEY=your_lyve_access_key
LYVE_SECRET_KEY=your_lyve_secret_key
LYVE_ENDPOINT=https://s3.lyvecloud.seagate.com
```

### Step 2: Run Database Migrations

#### AgentCache Database (JettySpeed tables):
```bash
cd /Users/letstaco/Documents/agentcache-ai
psql $DATABASE_URL -f database/jettyspeed-schema.sql
```

Verify:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM edge_locations;"
# Should return 20
```

#### JettyThunder Database (Provisioning tables):
```bash
cd /Users/letstaco/Documents/jettythunder-v2
npm run db:push

# Seed tier configurations
npx dotenv -e .env -- npx tsx scripts/seed-jettythunder.ts
```

Verify:
```bash
psql $DATABASE_URL -c "SELECT tier, storage_quota_gb FROM tier_configs;"
# Should show: free, starter, pro, business, enterprise
```

### Step 3: Start Both Servers

#### Terminal 1 - AgentCache:
```bash
cd /Users/letstaco/Documents/agentcache-ai
npm run dev
# Runs on http://localhost:3000
```

#### Terminal 2 - JettyThunder:
```bash
cd /Users/letstaco/Documents/jettythunder-v2
npm run dev
# Runs on http://localhost:3001 (or configured PORT)
```

### Step 4: Test Integration

Run the end-to-end integration test:
```bash
cd /Users/letstaco/Documents/agentcache-ai
./tests/test-jettythunder-integration.sh
```

Or test manually with curl:

**1. Provision a storage account:**
```bash
curl -X POST http://localhost:3000/api/webhooks/jettythunder/provision \
  -H "Authorization: Bearer $INTERNAL_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "usr_test_123",
    "email": "test@example.com",
    "tier": "pro"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "JettyThunder storage account created",
  "credentials": {
    "api_key": "jt_live_xxxxxxxxxxxxx",
    "api_secret": "secret_xxxxxxxxxxxxx",
    "storage_quota_gb": 20,
    "jetty_speed_enabled": true,
    "s3_bucket": "agentcache-assets",
    "s3_prefix": "users/usr_test_123",
    "provisioned_at": "2025-01-25T11:00:00.000Z"
  }
}
```

**2. Check quota:**
```bash
curl -X GET http://localhost:3001/api/agentcache/quota \
  -H "Authorization: Bearer jt_live_xxxxxxxxxxxxx"
```

**3. Upload a test file:**
```bash
echo "Hello JettyThunder!" > test.txt

curl -X POST http://localhost:3001/api/storage/upload \
  -H "Authorization: Bearer jt_live_xxxxxxxxxxxxx" \
  -H "X-Filename: test.txt" \
  -H "Content-Type: text/plain" \
  --data-binary @test.txt
```

**Expected Response:**
```json
{
  "success": true,
  "asset": {
    "id": "ast_123",
    "url": "https://s3.lyvecloud.seagate.com/agentcache-assets/users/usr_test_123/...",
    "key": "users/usr_test_123/1737804000000-abc123.txt",
    "size": 20,
    "hash": "sha256_hash_here"
  }
}
```

---

## API Endpoints

### AgentCache Endpoints

#### 1. Provision Storage Account
**Endpoint:** `POST /api/webhooks/jettythunder/provision`

**Auth:** Bearer token (INTERNAL_WEBHOOK_SECRET)

**Request:**
```json
{
  "user_id": "usr_abc123",
  "email": "user@example.com",
  "tier": "pro"
}
```

**Response:**
```json
{
  "success": true,
  "message": "JettyThunder storage account created",
  "credentials": {
    "api_key": "jt_live_...",
    "api_secret": "secret_...",
    "storage_quota_gb": 20,
    "jetty_speed_enabled": true,
    "s3_bucket": "agentcache-assets",
    "s3_prefix": "users/usr_abc123"
  }
}
```

### JettyThunder Endpoints

#### 1. Provision (Called by AgentCache)
**Endpoint:** `POST /api/agentcache/provision`

**Auth:** Bearer token (AGENTCACHE_WEBHOOK_SECRET)

#### 2. Upgrade Tier
**Endpoint:** `POST /api/agentcache/upgrade`

**Auth:** Bearer token (AGENTCACHE_WEBHOOK_SECRET)

**Request:**
```json
{
  "agentcache_user_id": "usr_abc123",
  "tier": "business"
}
```

#### 3. Check Quota
**Endpoint:** `GET /api/agentcache/quota`

**Auth:** Bearer token (User's API Key)

**Response:**
```json
{
  "storage": {
    "used_gb": 5.2,
    "quota_gb": 20,
    "percent": 26
  },
  "bandwidth": {
    "used_gb": 15.8,
    "quota_gb": 100,
    "percent": 15.8
  },
  "tier": "pro",
  "jetty_speed_enabled": true
}
```

#### 4. Upload File
**Endpoint:** `POST /api/storage/upload`

**Auth:** Bearer token (User's API Key)

**Headers:**
- `X-Filename`: test.mp4
- `Content-Type`: video/mp4

**Body:** Raw binary file content

---

## Storage Tiers

| Tier | Storage | Bandwidth | JettySpeed | Price |
|------|---------|-----------|------------|-------|
| Free | 0 GB | 0 GB | ❌ | $0 |
| Starter | 2 GB | 10 GB | ❌ | $19/mo |
| Pro | 20 GB | 100 GB | ✅ | $49/mo |
| Business | 100 GB | 500 GB | ✅ | $149/mo |
| Enterprise | 1 TB+ | 5 TB+ | ✅ | Custom |

---

## Integration Workflow

### User Signup Flow

1. **User signs up** on AgentCache.ai
2. **AgentCache calls** `/api/webhooks/jettythunder/provision`
   - User ID, email, tier (determined by payment)
3. **JettyThunder creates** storage account
   - Generates API key + secret
   - Sets up S3 prefix
   - Configures quota
4. **AgentCache caches** credentials in Redis
5. **User receives** storage credentials in dashboard
6. **Desktop app** uses credentials for uploads

### Upload Flow (with JettySpeed)

1. **Desktop app** requests optimal edges from AgentCache
   ```
   POST /api/jetty/optimal-edges
   ```
2. **AgentCache returns** 5 best edges + strategy
3. **Desktop app** splits file into chunks
4. **Uploads chunks** in parallel to edges (16-32 threads)
5. **Edges route** to Lyve Cloud S3
6. **JettyThunder tracks** asset in database
7. **Updates usage** quota

---

## Troubleshooting

### Error: "Unauthorized" when provisioning
**Fix:** Check that `JETTYTHUNDER_WEBHOOK_SECRET` in JettyThunder matches `JETTYTHUNDER_WEBHOOK_SECRET` in AgentCache

### Error: "Invalid tier"
**Fix:** Run seed script to populate tier_configs table:
```bash
cd /Users/letstaco/Documents/jettythunder-v2
npx dotenv -e .env -- npx tsx scripts/seed-jettythunder.ts
```

### Error: "Storage quota exceeded"
**Fix:** User needs to upgrade tier or delete old files

### Error: "Failed to connect to JettyThunder"
**Fix:** 
1. Check `JETTYTHUNDER_API_URL` is correct
2. Verify JettyThunder server is running
3. Check network connectivity

### Error: "S3 upload failed"
**Fix:** Verify Lyve Cloud credentials in JettyThunder `.env`:
```bash
LYVE_ACCESS_KEY=...
LYVE_SECRET_KEY=...
LYVE_ENDPOINT=https://s3.lyvecloud.seagate.com
```

---

## Production Deployment Checklist

### AgentCache (Vercel)
- [ ] Set `JETTYTHUNDER_API_URL=https://jettythunder.app`
- [ ] Set `JETTYTHUNDER_WEBHOOK_SECRET` (use strong secret generator)
- [ ] Set `INTERNAL_WEBHOOK_SECRET` (different from webhook secret)
- [ ] Run database migration (jettyspeed-schema.sql)
- [ ] Deploy to Vercel
- [ ] Test provisioning endpoint

### JettyThunder (Your hosting)
- [ ] Set `AGENTCACHE_WEBHOOK_SECRET` (match AgentCache)
- [ ] Set all Lyve Cloud S3 credentials
- [ ] Run `npm run db:push`
- [ ] Run seed script for tier_configs
- [ ] Deploy to production server
- [ ] Test all endpoints with production URLs

### Post-Launch
- [ ] Monitor provisioning success rate
- [ ] Track storage usage per tier
- [ ] Monitor JettySpeed performance (14x improvement target)
- [ ] Set up alerts for quota exceeded
- [ ] Monitor S3 costs

---

## Architecture Benefits

✅ **Automatic Provisioning** - Users get storage instantly on signup
✅ **Cached Credentials** - Redis cache prevents duplicate provisions (30-day TTL)
✅ **Quota Management** - Real-time tracking in JettyThunder database
✅ **JettySpeed Integration** - 14x faster uploads via edge routing
✅ **Deduplication** - SHA-256 hash tracking prevents duplicate storage
✅ **Multi-tier Support** - Free → Enterprise tiers with automatic upgrades

---

## Next Steps

1. **Deploy both systems** to production
2. **Test end-to-end** with real user signup
3. **Monitor performance** metrics (upload speed, deduplication rate)
4. **Build dashboard** for admins to view provisioning stats
5. **Add webhook** for tier upgrades (when user pays more)
6. **Implement** desktop app JettySpeed client (Rust)

---

## Support

**Questions about integration?**
- AgentCache docs: `docs/JETTY_SPEED_API.md`
- JettyThunder docs: `docs/walkthrough.md.resolved`
- Test scripts: `tests/test-jettythunder-integration.sh`

**Ready to launch! 🚀**
