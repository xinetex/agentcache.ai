# AgentCache Vendor Integration Guide

**Version:** 1.0  
**Last Updated:** November 25, 2025

---

## Overview

AgentCache is an **intelligent edge routing platform** that accelerates content delivery by routing traffic through optimal edge nodes. Storage vendors can integrate with AgentCache to provide seamless storage provisioning and accelerated uploads for AgentCache users.

This guide uses **JettyThunder** (Seagate Lyve Cloud storage) as the **reference implementation** for vendor integrations.

---

## Why Integrate with AgentCache?

### For Storage Vendors

- 📈 **Increased adoption** - Automatic provisioning when users sign up for AgentCache
- 🚀 **Differentiation** - JettySpeed protocol provides 5-14x faster uploads vs standard HTTP
- 💰 **Revenue sharing** - Commission on storage tier upgrades
- 🔌 **Easy integration** - Webhook-based provisioning, no complex SDK required
- 📊 **Analytics** - Track usage, bandwidth, and upload patterns

### For AgentCache Users

- ⚡ **Speed** - Multi-path uploads via edge routing
- 🎯 **Simplicity** - One-click storage provisioning
- 💾 **Choice** - Multiple vendor options (AWS S3, JettyThunder, GCS, etc.)
- 🔄 **Deduplication** - Cross-user file deduplication saves storage costs
- 📈 **Scalability** - Automatic tier upgrades as usage grows

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────┐
│  USER SIGNS UP → AgentCache Platform                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  AgentCache Provisioning Service                    │
│  • Checks vendor availability                       │
│  • Calls vendor webhook (POST /provision)           │
│  • Caches credentials (Redis, 30-day TTL)           │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS + Webhook Secret
                   ▼
┌─────────────────────────────────────────────────────┐
│  VENDOR API (Your System)                           │
│  POST /api/agentcache/provision                     │
│  • Create storage account                           │
│  • Generate API credentials                         │
│  • Set initial quota                                │
│  • Return account details                           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  USER UPLOADS → AgentCache JettySpeed               │
│  • Optimal edge selection                           │
│  • Multi-path chunked upload (5-14x faster)         │
│  • Deduplication check (instant if duplicate)       │
│  • Progress tracking & analytics                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  VENDOR STORAGE (Your System)                       │
│  POST /api/storage/upload                           │
│  • Store file in vendor backend                     │
│  • Update quota usage                               │
│  • Return storage metadata                          │
└─────────────────────────────────────────────────────┘
```

---

## Required Vendor APIs

### 1. Provisioning Endpoint

**Endpoint:** `POST /api/agentcache/provision`

**Purpose:** Create a new storage account when an AgentCache user signs up.

**Authentication:** Shared webhook secret (HMAC-SHA256 signature)

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "tier": "pro",
  "metadata": {
    "signupDate": "2025-11-25T12:00:00Z",
    "referral": "organic"
  }
}
```

**Response (200 OK):**
```json
{
  "accountId": "acct_abc123",
  "apiKey": "ak_live_xyz789",
  "apiSecret": "sk_live_secret456",
  "storageEndpoint": "https://storage.yourvendor.com",
  "tier": "pro",
  "quota": {
    "storage": 21474836480,
    "bandwidth": 107374182400
  },
  "features": {
    "jettySpeedEnabled": true,
    "deduplicationEnabled": true
  }
}
```

**Reference Implementation:** See `jettythunder-v2/server/routes/agentcache.ts`

---

### 2. Upgrade Endpoint

**Endpoint:** `POST /api/agentcache/upgrade`

**Purpose:** Upgrade a user's storage tier.

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "accountId": "acct_abc123",
  "newTier": "business"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "tier": "business",
  "quota": {
    "storage": 107374182400,
    "bandwidth": 536870912000
  }
}
```

---

### 3. Quota Check Endpoint

**Endpoint:** `GET /api/agentcache/quota?userId={userId}&accountId={accountId}`

**Purpose:** Check current quota usage.

**Response (200 OK):**
```json
{
  "accountId": "acct_abc123",
  "tier": "pro",
  "storage": {
    "used": 5368709120,
    "limit": 21474836480,
    "percentUsed": 25
  },
  "bandwidth": {
    "used": 10737418240,
    "limit": 107374182400,
    "percentUsed": 10
  }
}
```

---

### 4. Upload Endpoint

**Endpoint:** `POST /api/storage/upload`

**Purpose:** Store uploaded files from AgentCache edges.

**Authentication:** API key + secret from provisioning response

**Request Headers:**
```
Authorization: Bearer {apiKey}
X-API-Secret: {apiSecret}
Content-Type: multipart/form-data
X-File-Hash: sha256:abc123...
X-User-Id: 550e8400-e29b-41d4-a716-446655440000
```

**Request Body:**
```
file: [binary data]
metadata: {
  "fileName": "video.mp4",
  "mimeType": "video/mp4",
  "fileSize": 52428800,
  "uploadSource": "jettyspeed"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "assetId": "ast_xyz789",
  "storageKey": "users/550e8400/video.mp4",
  "cdnUrl": "https://cdn.yourvendor.com/users/550e8400/video.mp4",
  "size": 52428800,
  "quotaRemaining": 16106127360
}
```

---

## Security Requirements

### 1. Webhook Signature Verification

All provisioning/upgrade requests from AgentCache include an HMAC-SHA256 signature:

```http
X-Webhook-Signature: sha256=abc123def456...
X-Webhook-Timestamp: 1700000000
```

**Verification Example (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhook(req, secret) {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const body = JSON.stringify(req.body);
  
  // Prevent replay attacks (5 min window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    throw new Error('Webhook timestamp too old');
  }
  
  // Verify signature
  const payload = `${timestamp}.${body}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const expected = `sha256=${expectedSig}`;
  if (signature !== expected) {
    throw new Error('Invalid webhook signature');
  }
  
  return true;
}
```

### 2. API Authentication

Upload requests use API key + secret:

```http
Authorization: Bearer {apiKey}
X-API-Secret: {apiSecret}
```

Vendors should validate both before accepting uploads.

---

## Storage Tiers (Recommended)

AgentCache recommends vendors offer tiered pricing:

| Tier | Storage | Bandwidth | JettySpeed | Price | Margin Target |
|------|---------|-----------|------------|-------|---------------|
| Free | 0 GB | 0 GB | ❌ | $0 | - |
| Starter | 2 GB | 10 GB | ❌ | $19/mo | 75% |
| Pro | 20 GB | 100 GB | ✅ | $49/mo | 79% |
| Business | 100 GB | 500 GB | ✅ | $149/mo | 77% |
| Enterprise | 1 TB+ | 5 TB+ | ✅ | Custom | 75%+ |

**Note:** JettySpeed (multi-path acceleration) is a premium feature for Pro+ tiers.

---

## JettySpeed Protocol (Optional)

JettySpeed is AgentCache's **multi-path upload acceleration protocol** that provides 5-14x faster uploads.

### How It Works

1. **User uploads file** via AgentCache
2. **AgentCache splits file** into chunks (10-100MB adaptive sizing)
3. **Chunks routed to 3-5 optimal edges** based on:
   - Geographic proximity
   - Edge latency & load
   - Bandwidth availability
4. **Edges forward chunks** to vendor storage in parallel
5. **Vendor reassembles** chunks into original file
6. **Deduplication check** - If file hash exists, skip upload entirely

### Performance Targets

| File Size | Standard Upload | JettySpeed | Speedup |
|-----------|----------------|------------|---------|
| 100 MB | 45 seconds | 5 seconds | **9x** |
| 1 GB | 7 minutes | 35 seconds | **12x** |
| 10 GB | 70 minutes | 5 minutes | **14x** |
| Duplicate | Full upload | 0.5 seconds | **140x** |

### Implementation

**Option A:** Vendor implements chunk reassembly
- AgentCache sends chunks to vendor endpoint
- Vendor stores chunks and reassembles
- More control, but more implementation work

**Option B:** Vendor uses AgentCache proxy
- AgentCache handles chunk reassembly
- Sends complete file to vendor
- Simpler, but less control

**JettyThunder uses Option A** for maximum performance. See implementation at:
`/Users/letstaco/Documents/jettythunder-v2/server/routes/storage.ts`

---

## Testing Your Integration

### 1. Sandbox Environment

AgentCache provides a sandbox environment for testing:

```bash
export AGENTCACHE_ENV=sandbox
export AGENTCACHE_API_URL=https://sandbox.agentcache.ai
export WEBHOOK_SECRET=test_secret_123
```

### 2. Test Provisioning

```bash
curl -X POST https://your-vendor.com/api/agentcache/provision \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=..." \
  -H "X-Webhook-Timestamp: 1700000000" \
  -d '{
    "userId": "test-user-123",
    "email": "test@example.com",
    "tier": "pro"
  }'
```

### 3. Test Upload

```bash
curl -X POST https://your-vendor.com/api/storage/upload \
  -H "Authorization: Bearer ak_test_xyz" \
  -H "X-API-Secret: sk_test_abc" \
  -F "file=@test-video.mp4" \
  -F 'metadata={"fileName":"test-video.mp4"}'
```

### 4. Integration Test Suite

AgentCache provides an integration test suite:

```bash
cd /Users/letstaco/Documents/agentcache-ai
./tests/test-jettythunder-integration.sh
```

Expected output:
```
✅ Provisioning: Created account in 1.2s
✅ Quota check: Retrieved quota in 0.3s
✅ Upload: 50MB file uploaded in 4.8s
✅ Deduplication: Duplicate detected in 0.1s
✅ Upgrade: Tier upgraded in 0.9s
```

---

## Go-Live Checklist

### Pre-Launch

- [ ] Implement all 4 required endpoints (provision, upgrade, quota, upload)
- [ ] Add webhook signature verification
- [ ] Set up sandbox environment
- [ ] Run integration tests (all pass)
- [ ] Load test: 100 concurrent uploads
- [ ] Security audit: pen test webhook endpoints

### Launch Configuration

- [ ] Register with AgentCache vendor portal
- [ ] Provide production API URLs
- [ ] Exchange webhook secrets (use secure channel)
- [ ] Configure tier pricing
- [ ] Set quota limits
- [ ] Enable JettySpeed (if supported)

### Post-Launch

- [ ] Monitor provisioning latency (<3s target)
- [ ] Track upload success rate (>99% target)
- [ ] Review quota utilization
- [ ] Collect user feedback
- [ ] Optimize edge routing based on analytics

---

## Vendor Portal

Once integrated, vendors get access to the **AgentCache Vendor Portal**:

**Dashboard:**
- Real-time provisioning metrics
- Upload bandwidth usage
- User tier distribution
- Revenue analytics

**Analytics:**
- Geographic distribution of uploads
- Edge performance by region
- JettySpeed acceleration metrics
- Deduplication savings

**Settings:**
- Update webhook URLs
- Rotate API credentials
- Configure tier pricing
- Set commission rates

**Access:** https://vendors.agentcache.ai

---

## Support & Resources

### Documentation

- **JettyThunder Reference Implementation:**
  - Backend: `/Users/letstaco/Documents/jettythunder-v2/server/routes/agentcache.ts`
  - Database: `/Users/letstaco/Documents/jettythunder-v2/server/db/jettythunder-schema.ts`
  - Tests: `/Users/letstaco/Documents/agentcache-ai/tests/test-jettythunder-integration.sh`

- **AgentCache API Reference:** `docs/JETTY_SPEED_API.md`
- **Integration Architecture:** `docs/AGENTCACHE_JETTYTHUNDER_INTEGRATION.md`

### Developer Support

- **Email:** vendors@agentcache.ai
- **Slack:** #vendor-integrations
- **Office Hours:** Tuesdays 2-4pm PT

### SLA Commitments

AgentCache guarantees:
- **99.9% uptime** for provisioning webhooks
- **<500ms latency** for edge routing decisions
- **24/7 support** for production issues
- **Weekly sync calls** during integration

---

## Revenue Sharing

### Commission Structure

| User Tier | Monthly Price | Vendor Revenue | AgentCache Fee |
|-----------|---------------|----------------|----------------|
| Starter | $19 | $14.25 (75%) | $4.75 (25%) |
| Pro | $49 | $36.75 (75%) | $12.25 (25%) |
| Business | $149 | $111.75 (75%) | $37.25 (25%) |
| Enterprise | Custom | 75% | 25% |

### Payment Terms

- **Net 30** via Stripe Connect
- **Monthly invoicing** on the 1st
- **Automatic payouts** to vendor bank account
- **Transparent reporting** via vendor portal

---

## FAQ

### Q: Can we use our own edge network instead of AgentCache edges?

**A:** Yes! You can register your edge nodes with AgentCache and they'll be included in routing decisions. JettyThunder does this with their local CDN (localhost:53777) for desktop uploads.

### Q: What happens if our API is down during provisioning?

**A:** AgentCache retries 3 times with exponential backoff. If still failing, user is notified and provisioning is queued for retry. We recommend 99.9% uptime SLA.

### Q: Do we need to implement JettySpeed protocol?

**A:** No, it's optional. Basic integration only requires the 4 standard endpoints. JettySpeed adds 5-14x speed improvement but requires chunk reassembly logic.

### Q: Can we offer different pricing than the recommended tiers?

**A:** Yes, pricing is flexible. Recommended tiers are just guidelines. Configure your pricing in the vendor portal.

### Q: How is deduplication handled?

**A:** AgentCache checks file hashes before upload. If duplicate exists, upload is skipped and user is linked to existing file. Vendors store files once, reference many times.

---

## Next Steps

1. **Review JettyThunder implementation** (reference code in `/Users/letstaco/Documents/jettythunder-v2/`)
2. **Set up development environment** (sandbox API keys)
3. **Implement required endpoints** (provision, upgrade, quota, upload)
4. **Run integration tests** (`./tests/test-jettythunder-integration.sh`)
5. **Schedule vendor onboarding call** (vendors@agentcache.ai)

---

**Ready to integrate? Let's accelerate content delivery together! 🚀**

**Contact:** vendors@agentcache.ai  
**Docs:** https://docs.agentcache.ai/vendors  
**Portal:** https://vendors.agentcache.ai
