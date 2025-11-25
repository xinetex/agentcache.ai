# JettyThunder Setup Checklist for AgentCache Integration

## Current Status: 🟡 Partial Setup

**What's Done**:
- ✅ Basic environment variables configured
- ✅ Webhook secret shared
- ✅ Rust uploader built (16-32 threads)
- ✅ Desktop CDN running (localhost:53777)

**What's Missing**: See below ⬇️

---

## Phase 1: Database Setup (CRITICAL - 1 hour)

### Step 1.1: Create Database Schema

**Location**: `jettythunder-v2/database/schema.sql`

Run this SQL file to create all required tables:

```sql
-- AgentCache Integration Schema

-- 1. AgentCache Accounts
CREATE TABLE agentcache_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agentcache_user_id UUID NOT NULL UNIQUE,
  agentcache_email VARCHAR(255) NOT NULL,
  agentcache_tier VARCHAR(20) NOT NULL,
  
  api_key VARCHAR(255) NOT NULL UNIQUE,
  api_secret VARCHAR(255) NOT NULL,
  
  storage_quota_gb INTEGER NOT NULL,
  storage_used_gb DECIMAL(10,2) DEFAULT 0,
  bandwidth_quota_gb INTEGER NOT NULL,
  bandwidth_used_gb DECIMAL(10,2) DEFAULT 0,
  
  jetty_speed_enabled BOOLEAN DEFAULT false,
  
  s3_bucket_name VARCHAR(255) NOT NULL,
  s3_prefix VARCHAR(255) NOT NULL,
  
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agentcache_accounts_user ON agentcache_accounts(agentcache_user_id);
CREATE INDEX idx_agentcache_accounts_api_key ON agentcache_accounts(api_key);

-- 2. Tier Configurations
CREATE TABLE tier_configs (
  tier VARCHAR(20) PRIMARY KEY,
  storage_quota_gb INTEGER NOT NULL,
  bandwidth_quota_gb INTEGER NOT NULL,
  jetty_speed_enabled BOOLEAN DEFAULT false,
  rate_limit_per_minute INTEGER DEFAULT 60,
  max_file_size_mb INTEGER DEFAULT 100
);

-- Seed tier data
INSERT INTO tier_configs VALUES
  ('free', 0, 0, false, 10, 10),
  ('starter', 2, 10, false, 60, 50),
  ('pro', 20, 50, true, 300, 500),
  ('business', 100, 200, true, 1000, 1000),
  ('enterprise', 1000, 5000, true, 10000, 5000);

-- 3. Asset Storage
CREATE TABLE agentcache_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES agentcache_accounts(id) ON DELETE CASCADE,
  
  s3_key TEXT NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  
  filename TEXT NOT NULL,
  content_type VARCHAR(100),
  size_bytes BIGINT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  
  cache_key TEXT,
  agentcache_pipeline_id UUID,
  
  hit_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  expires_at TIMESTAMP,
  
  uploaded_via VARCHAR(20) DEFAULT 'api',
  upload_speed_mbps DECIMAL(10,2),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_account ON agentcache_assets(account_id);
CREATE INDEX idx_assets_hash ON agentcache_assets(content_hash);
CREATE INDEX idx_assets_cache_key ON agentcache_assets(cache_key);

-- 4. Storage Usage Tracking
CREATE TABLE storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES agentcache_accounts(id) ON DELETE CASCADE,
  
  storage_bytes BIGINT NOT NULL,
  bandwidth_bytes BIGINT NOT NULL,
  request_count INTEGER NOT NULL,
  
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  storage_cost DECIMAL(10,4),
  bandwidth_cost DECIMAL(10,4),
  total_cost DECIMAL(10,4),
  
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_storage_usage_account ON storage_usage(account_id);
```

**Run the migration**:
```bash
cd ~/Documents/jettythunder-v2
psql $DATABASE_URL < database/schema.sql
```

**Verify**:
```bash
psql $DATABASE_URL -c "SELECT * FROM tier_configs;"
# Should show 5 tiers: free, starter, pro, business, enterprise
```

---

## Phase 2: Environment Configuration (10 minutes)

### Step 2.1: Update .env File

**Location**: `jettythunder-v2/.env`

Add these missing variables:

```bash
# Existing (keep these)
JETTYTHUNDER_API_URL=http://localhost:3000/api/agentcache
AGENTCACHE_WEBHOOK_SECRET=shared_secret_here_123456789

# ADD THESE NEW VARIABLES:

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/jettythunder

# Lyve Cloud S3 (REQUIRED)
LYVE_ENDPOINT=https://s3.lyvecloud.seagate.com
LYVE_REGION=us-east-1
LYVE_ACCESS_KEY_ID=<YOUR_LYVE_ACCESS_KEY>
LYVE_SECRET_ACCESS_KEY=<YOUR_LYVE_SECRET_KEY>
LYVE_BUCKET_NAME=agentcache-assets

# AgentCache API (for reverse integration)
AGENTCACHE_API_URL=https://agentcache.ai/api

# JettySpeed Configuration
JETTYSPEED_ENABLED=true
JETTYSPEED_CDN_URL=http://localhost:53777
JETTYSPEED_MAX_THREADS=32
JETTYSPEED_CHUNK_SIZE_MB=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=<optional>
```

### Step 2.2: Create S3 Bucket

```bash
# Install AWS CLI if not already installed
brew install awscli

# Configure AWS CLI for Lyve Cloud
aws configure set aws_access_key_id $LYVE_ACCESS_KEY_ID
aws configure set aws_secret_access_key $LYVE_SECRET_ACCESS_KEY
aws configure set region us-east-1

# Create bucket
aws s3 mb s3://agentcache-assets --endpoint-url=https://s3.lyvecloud.seagate.com

# Verify
aws s3 ls --endpoint-url=https://s3.lyvecloud.seagate.com
```

---

## Phase 3: API Endpoints (2-3 hours)

### Step 3.1: Create API Structure

**Required files** (reference: `/Users/letstaco/Documents/agentcache-ai/docs/JETTYTHUNDER_INTEGRATION_GUIDE.md`):

```
jettythunder-v2/
├── server/
│   ├── routes/
│   │   ├── agentcache.ts          # NEW - Provision/upgrade endpoints
│   │   ├── storage.ts             # NEW - Upload/download endpoints
│   │   └── streaming.ts           # EXISTING - Fix video streaming
│   ├── lib/
│   │   ├── s3-client.ts           # NEW - Lyve Cloud integration
│   │   ├── api-key-generator.ts  # NEW - Generate API keys
│   │   └── quota-enforcer.ts     # NEW - Check quotas
│   └── middleware/
│       └── authenticate.ts        # NEW - Verify API keys
```

### Step 3.2: Implement Core Endpoints

**Priority Order**:

1. **POST /api/agentcache/provision** (CRITICAL)
   - Creates storage account for new AgentCache user
   - Generates API key/secret
   - Creates S3 folder
   - See full implementation in: `JETTYTHUNDER_INTEGRATION_GUIDE.md` (lines 231-357)

2. **POST /api/agentcache/upgrade** (CRITICAL)
   - Updates tier allocation
   - Adjusts quotas
   - See implementation: `JETTYTHUNDER_INTEGRATION_GUIDE.md` (lines 359-440)

3. **GET /api/agentcache/quota** (HIGH PRIORITY)
   - Returns current usage
   - Storage/bandwidth stats
   - Warns if nearing quota

4. **POST /api/storage/upload** (HIGH PRIORITY)
   - Upload asset to S3
   - Track in database
   - Support JettySpeed acceleration

5. **GET /api/storage/download** (HIGH PRIORITY)
   - Generate presigned URL
   - Track bandwidth usage

### Step 3.3: Copy Implementation Code

The complete TypeScript code for all endpoints is in:
- **File**: `/Users/letstaco/Documents/agentcache-ai/docs/JETTYTHUNDER_INTEGRATION_GUIDE.md`
- **Lines**: 231-599 (API endpoints)
- **Lines**: 443-599 (S3 client, API key generator)

**Action**: Copy this code into your JettyThunder project.

---

## Phase 4: JettySpeed Protocol Integration (1 week)

### Step 4.1: Review Existing Rust Uploader

**Location**: `jettythunder-v2/src-tauri/src/uploader_v2.rs`

**Current capabilities** (from Warp Drive Notebook):
- ✅ Multi-threaded (16-32 threads)
- ✅ Direct to Lyve Cloud
- ✅ Progress tracking

**What to add**:
- Multi-path routing (split chunks across edges)
- AgentCache edge selection
- Adaptive chunk sizing

### Step 4.2: Add AgentCache Edge Integration

**New file**: `src-tauri/src/jetty_speed.rs`

```rust
pub struct JettySpeedUploader {
    edges: Vec<EdgeLocation>,
    lyve_client: S3Client,
    agent_cache: AgentCacheClient,
}

impl JettySpeedUploader {
    pub async fn upload_with_acceleration(
        &self,
        file_path: &Path,
    ) -> Result<UploadResult> {
        // 1. Ping AgentCache edges to find fastest
        let edges = self.ping_edges().await?;
        
        // 2. Split file into chunks
        let chunks = self.chunk_file(file_path, 10_000_000)?; // 10MB chunks
        
        // 3. Upload chunks to different edges in parallel
        let mut handles = vec![];
        for (chunk, edge) in chunks.iter().zip(edges.iter().cycle()) {
            let handle = self.upload_chunk_to_edge(chunk, edge);
            handles.push(handle);
        }
        
        // 4. Wait for all uploads
        futures::future::try_join_all(handles).await?;
        
        Ok(UploadResult { /* ... */ })
    }
    
    async fn ping_edges(&self) -> Result<Vec<EdgeLocation>> {
        // Query AgentCache for closest edges
        let response = reqwest::get("https://agentcache.ai/api/edges").await?;
        let edges: Vec<EdgeLocation> = response.json().await?;
        Ok(edges)
    }
}
```

### Step 4.3: Cloudflare Worker for Edge Routing

**New file**: `cloudflare-worker/jetty-speed-worker.ts`

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { chunkData, fileId, chunkIndex } = await request.json();
    
    // Stream chunk to Lyve Cloud
    const lyveResponse = await fetch(env.LYVE_ENDPOINT, {
      method: 'PUT',
      body: chunkData,
      headers: {
        'Authorization': `AWS ${env.LYVE_ACCESS_KEY}:${signature}`
      }
    });
    
    // Cache metadata in AgentCache
    await env.AGENT_CACHE.put(
      `chunk:${fileId}:${chunkIndex}`,
      JSON.stringify({ uploaded: true, edge: request.cf?.colo })
    );
    
    return new Response('OK');
  }
};
```

---

## Phase 5: Testing (1-2 days)

### Test 1: Provision Account

```bash
curl -X POST http://localhost:3000/api/agentcache/provision \
  -H "Authorization: Bearer shared_secret_here_123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "agentcache_user_id": "test-123",
    "agentcache_email": "test@example.com",
    "tier": "pro"
  }'

# Expected: Returns API key + secret
```

### Test 2: Upload File

```bash
curl -X POST http://localhost:3000/api/storage/upload \
  -H "Authorization: Bearer jt_test_xxxxxxxx" \
  -H "X-API-Secret: jts_xxxxxxxx" \
  -F "file=@test.jpg"

# Expected: Returns S3 key and URL
```

### Test 3: Check Quota

```bash
curl -X GET http://localhost:3000/api/agentcache/quota \
  -H "Authorization: Bearer jt_test_xxxxxxxx" \
  -H "X-API-Secret: jts_xxxxxxxx"

# Expected: Returns storage usage stats
```

### Test 4: JettySpeed Upload (Desktop App)

```bash
# From desktop app
./jettythunder upload --file large-video.mp4 --accelerate

# Should see:
# [✓] Split into 50 chunks
# [✓] Routing to 5 edge locations
# [✓] Upload speed: 250 MB/s (3x faster than standard)
# [✓] Complete in 45 seconds
```

---

## Phase 6: AgentCache Integration (AgentCache side)

### On AgentCache Side (We'll Handle This)

**File**: `agentcache-ai/api/webhooks/provision-storage.ts`

```typescript
export async function provisionJettyThunderStorage(
  userId: string,
  email: string,
  tier: string
) {
  const response = await fetch('http://localhost:3000/api/agentcache/provision', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.JETTYTHUNDER_WEBHOOK_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agentcache_user_id: userId,
      agentcache_email: email,
      tier: tier
    })
  });
  
  const data = await response.json();
  
  // Store credentials in AgentCache DB
  await db.query(
    `INSERT INTO jettythunder_credentials (user_id, api_key, api_secret, tier)
     VALUES ($1, $2, $3, $4)`,
    [userId, data.account.api_key, data.account.api_secret, tier]
  );
  
  return data;
}
```

**When we call this**:
- User signs up on AgentCache
- User upgrades to Pro/Business/Enterprise tier
- User enables multimodal cache

---

## Success Criteria

### ✅ Phase 1-2 Complete When:
- [ ] Database tables created and seeded
- [ ] Can query: `SELECT * FROM tier_configs;`
- [ ] S3 bucket exists: `aws s3 ls s3://agentcache-assets --endpoint-url=...`
- [ ] Environment variables loaded

### ✅ Phase 3 Complete When:
- [ ] POST /api/agentcache/provision returns API key
- [ ] POST /api/agentcache/upgrade updates tier
- [ ] GET /api/agentcache/quota returns usage
- [ ] Can upload/download files via API

### ✅ Phase 4 Complete When:
- [ ] JettySpeed uploader splits files into chunks
- [ ] Chunks upload to multiple edges in parallel
- [ ] 3x faster than baseline (single-thread) upload
- [ ] Desktop app shows "JettySpeed Enabled" badge

### ✅ Phase 5 Complete When:
- [ ] All curl tests pass
- [ ] Can provision test account
- [ ] Can upload 100MB file in <10 seconds
- [ ] Storage quota tracking works

---

## Priority Execution Order

**Week 1** (This week):
1. Database setup (1 hour) - DO FIRST
2. Environment config (10 min) - DO SECOND
3. Provision endpoint (2 hours) - DO THIRD
4. Upload/Download endpoints (3 hours) - DO FOURTH

**Week 2**:
5. JettySpeed integration (3-4 days)
6. Testing and validation (2-3 days)

**Week 3**:
7. AgentCache integration (we handle this)
8. Production deployment

---

## Reference Documents

All implementation code is in:
- **Main Guide**: `/Users/letstaco/Documents/agentcache-ai/docs/JETTYTHUNDER_INTEGRATION_GUIDE.md`
- **Storage Economics**: `/Users/letstaco/Documents/agentcache-ai/docs/STORAGE_ECONOMICS.md`
- **JettySpeed Protocol**: Warp Drive Notebook (attached)

---

## Need Help?

If you encounter any blockers:

1. **Database issues**: Check `psql $DATABASE_URL -c "\dt"` to list tables
2. **S3 connection**: Verify Lyve credentials with `aws s3 ls --endpoint-url=...`
3. **API not responding**: Check logs in `jettythunder-v2/logs/`
4. **JettySpeed slow**: Monitor `uploader_v2.rs` thread count

**Contact AgentCache team when**:
- Database schema is ready
- Provision endpoint works
- Ready to test end-to-end flow

---

**Status**: 🟡 Ready for Phase 1-2 implementation

Let's get started with database setup!
