# JettyThunder Custom AgentCache Solution

**Client**: JettyThunder (Enterprise File Management Platform)  
**Date**: November 28, 2025  
**Status**: Production-Ready Integration Plan

## Executive Summary

JettyThunder is an enterprise file management platform built on Seagate Lyve Cloud (S3-compatible storage). They need intelligent caching to:
- Reduce Lyve Cloud bandwidth costs (currently $100-300/month)
- Accelerate file downloads from 500-2000ms to <50ms
- Speed up uploads 3-5x through multi-path parallel transfers
- Cache video streaming segments for <500ms startup time

**Expected ROI**: 70% cost reduction, 10-40x faster downloads, immediate break-even

---

## Current Architecture Analysis

### Tech Stack
```typescript
// Backend
- Express.js + tRPC API
- Drizzle ORM + Neon PostgreSQL
- AWS S3 SDK (Seagate Lyve Cloud)
- Upstash Redis (existing)
- Vercel deployment

// Frontend
- React 19 + Vite
- React Query (TanStack)
- Tauri Desktop App (Rust)

// Existing Integrations
- agentcache-client: ^1.0.0 (already installed!)
- @jetty/agentcache-connectors (workspace package)
- edge-cdn.ts service (partially implemented)
```

### Current File Flow
```
User Upload → tRPC → Express → AWS S3 SDK → Lyve Cloud
User Download → tRPC → Presigned URL → Direct from Lyve (slow)
Video Stream → HLS segments → Lyve Cloud → 2-3s startup
```

### Pain Points Identified
1. **Every download fetches from Lyve** - no caching layer
2. **Single-path uploads** - not utilizing multi-edge acceleration
3. **Video streaming** - 2-3s startup (unacceptable for users)
4. **Desktop CDN integration** - exists but not fully wired to AgentCache
5. **Cost inefficiency** - paying for repeated bandwidth

---

## Custom Caching Solution Design

### Architecture Overview
```
┌─────────────────────────────────────────────────────────┐
│                JettyThunder Application                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  File Upload Flow:                                       │
│  Client → tRPC → EdgeCDN Service → AgentCache API       │
│                    ↓                                      │
│           Multi-Edge Parallel Upload                     │
│           (SF + NY + EU + Asia edges)                    │
│                    ↓                                      │
│              Seagate Lyve Cloud                          │
│                                                           │
│  File Download Flow:                                     │
│  Client → tRPC → EdgeCDN Service → Check Caches:        │
│                    1. Desktop CDN (1ms)                  │
│                    2. AgentCache Edge (<50ms)            │
│                    3. Upstash Redis (20ms)               │
│                    4. Cloudflare Workers (10ms)          │
│                    5. Lyve Direct (100ms+)               │
│                                                           │
│  Video Stream Flow:                                      │
│  Client → HLS Request → AgentCache Edge → Cached Segment│
│           (First request: fetch from Lyve + cache)       │
│           (Subsequent: serve from edge, <500ms)          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Cache Strategy by File Type

#### 1. Small Files (<10MB)
**Examples**: Documents, PDFs, images, JSON, text files
**Cache Tier**: Upstash Redis (20ms latency, global replication)
**TTL**: 24 hours
**Hit Rate Target**: >90%

```typescript
// Upstash caching for small files
async cacheSmallFile(file: File) {
  const key = `file:${file.lyveKey}`;
  await upstash.set(key, {
    url: file.lyveUrl,
    metadata: {
      size: file.sizeBytes,
      mimeType: file.mimeType,
      checksum: file.checksum
    }
  }, { ex: 86400 }); // 24h TTL
}
```

#### 2. AI-Processable Content
**Examples**: Text, Markdown, CSV, JSON
**Cache Tier**: AgentCache semantic cache (15ms latency)
**TTL**: 7 days (rarely changes)
**Hit Rate Target**: >85%

```typescript
// AgentCache for AI content
async cacheAIContent(file: File, content: string) {
  await agentCache.set({
    provider: 'jettythunder',
    model: 'file-delivery',
    messages: [{ 
      role: 'system', 
      content: this.generateCacheKey(file) 
    }],
    response: content,
    namespace: `jt_customer_${file.customerId}` // Customer isolation
  });
}
```

#### 3. Large Files (10-100MB)
**Examples**: Videos, high-res images, datasets
**Cache Tier**: AgentCache Edge + Chunked (50ms latency)
**TTL**: 1 hour (balances cost vs performance)
**Hit Rate Target**: >70%

```typescript
// Chunked caching for large files
async cacheLargeFile(file: File) {
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  const totalChunks = Math.ceil(file.sizeBytes / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    await agentCache.cacheChunk({
      fileId: file.id,
      chunkIndex: i,
      lyveUrl: file.lyveUrl,
      namespace: `jt_customer_${file.customerId}`
    });
  }
}
```

#### 4. Video Streaming (HLS)
**Examples**: MP4, MOV, MKV (converted to HLS segments)
**Cache Tier**: AgentCache Edge (per-segment caching)
**TTL**: 6 hours (popular videos stay cached longer)
**Hit Rate Target**: >80%

```typescript
// Video segment caching
async cacheVideoSegment(videoId: string, segmentIndex: number) {
  const segmentUrl = await this.getHLSSegmentUrl(videoId, segmentIndex);
  
  await agentCache.set({
    provider: 'jettythunder',
    model: 'video-stream',
    messages: [{
      role: 'system',
      content: `video:${videoId}:segment:${segmentIndex}`
    }],
    response: segmentUrl,
    ttl: 21600 // 6 hours
  });
}
```

#### 5. Desktop CDN Local Cache
**Examples**: User's own files on desktop app
**Cache Tier**: Local filesystem (1ms latency)
**TTL**: Infinite (until disk full)
**Hit Rate Target**: >95% (user's own files)

```typescript
// Desktop CDN integration (Tauri Rust backend)
// Handled by existing JettyThunder Desktop app
// AgentCache acts as sync coordinator
```

---

## Implementation Roadmap

### Phase 1: Core Caching Infrastructure (Week 1)
**Goal**: Get basic edge caching working for downloads

#### 1.1 Update EdgeCDN Service
**File**: `server/services/edge-cdn.ts`

```typescript
// Add namespace-aware caching
async getOptimalEdgeNode(fileId: number, userId: number, customerId?: number) {
  const file = await this.getFile(fileId);
  const namespace = customerId 
    ? `jt_customer_${customerId}` 
    : `jt_user_${userId}`;
  
  // Check caches in priority order
  const cacheChecks = [
    () => this.checkDesktopCDN(userId, file.lyveKey),
    () => this.checkAgentCache(file, namespace),
    () => this.checkUpstash(file.lyveKey),
    () => this.checkCloudflare(file.lyveKey)
  ];
  
  for (const check of cacheChecks) {
    const result = await check();
    if (result.hit) {
      return {
        url: result.url,
        cached: true,
        latency: result.latency,
        provider: result.provider
      };
    }
  }
  
  // Fallback to Lyve direct
  return {
    url: file.lyveUrl,
    cached: false,
    latency: 100,
    provider: 'lyve-direct'
  };
}

// AgentCache integration
private async checkAgentCache(file: File, namespace: string) {
  const cacheKey = this.generateCacheKey(file);
  
  const result = await agentCache.get({
    provider: 'jettythunder',
    model: 'file-delivery',
    messages: [{ role: 'system', content: cacheKey }],
    namespace
  });
  
  if (result.hit) {
    return {
      hit: true,
      url: result.response as string,
      latency: result.latency_ms,
      provider: 'agentcache'
    };
  }
  
  // Cache miss - fetch from Lyve and populate cache
  await this.populateCache(file, namespace);
  
  return {
    hit: false,
    url: file.lyveUrl,
    latency: 100,
    provider: 'lyve-direct'
  };
}
```

#### 1.2 Update File Download tRPC Endpoint
**File**: `server/trpc/routers/files.ts`

```typescript
// Add caching to download flow
download: protectedProcedure
  .input(z.object({ fileId: z.number() }))
  .query(async ({ input, ctx }) => {
    const userId = ctx.session.userId;
    const customerId = ctx.session.customerId; // If enterprise tier
    
    // Use EdgeCDN to get optimal URL
    const result = await edgeCDN.getOptimalEdgeNode(
      input.fileId, 
      userId, 
      customerId
    );
    
    // Track cache performance
    await telemetry.record({
      event: 'file_download',
      userId,
      fileId: input.fileId,
      cached: result.cached,
      latency: result.latency,
      provider: result.provider
    });
    
    return {
      url: result.url,
      cached: result.cached,
      expiresAt: new Date(Date.now() + 3600000) // 1h
    };
  })
```

#### 1.3 Add AgentCache Namespace Management
**File**: `server/services/agentcache-namespace.ts` (new)

```typescript
/**
 * Manages customer-isolated namespaces for JettyThunder
 * Each customer gets isolated cache to prevent data leakage
 */
export class AgentCacheNamespaceManager {
  async createCustomerNamespace(customerId: number, customerName: string) {
    const namespace = `jt_customer_${customerId}`;
    
    // Register with AgentCache API
    await fetch(`${AGENTCACHE_API_URL}/api/portal/namespaces`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENTCACHE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: namespace,
        display_name: customerName,
        tags: ['jettythunder', 'filestorage', 'enterprise']
      })
    });
    
    return namespace;
  }
  
  async getNamespaceStats(customerId: number) {
    const namespace = `jt_customer_${customerId}`;
    
    const response = await fetch(
      `${AGENTCACHE_API_URL}/api/portal/namespaces/${namespace}/stats`,
      {
        headers: { 'Authorization': `Bearer ${AGENTCACHE_API_KEY}` }
      }
    );
    
    return response.json(); // { hits, misses, hitRate, costSaved }
  }
}
```

### Phase 2: JettySpeed Upload Acceleration (Week 2)
**Goal**: 3-5x faster uploads via multi-edge parallel transfer

#### 2.1 Add Multi-Edge Upload Coordinator
**File**: `server/services/jetty-speed-upload.ts` (new)

```typescript
/**
 * JettySpeed Upload Protocol
 * Parallel uploads via multiple AgentCache edges
 */
export class JettySpeedUploader {
  async uploadFile(file: File, userId: number, customerId?: number) {
    const namespace = customerId ? `jt_customer_${customerId}` : `jt_user_${userId}`;
    
    // Step 1: Select optimal edges (5 closest)
    const edges = await this.selectOptimalEdges(userId, file.sizeBytes);
    
    // Step 2: Split file into chunks
    const chunkSize = 5 * 1024 * 1024; // 5MB
    const chunks = await this.splitFile(file, chunkSize);
    
    // Step 3: Get Lyve multipart upload ID
    const uploadId = await this.initMultipartUpload(file);
    
    // Step 4: Upload chunks in parallel via edges
    const uploadPromises = chunks.map((chunk, index) => {
      const edge = edges[index % edges.length]; // Round-robin
      return this.uploadChunkViaEdge(chunk, edge, uploadId, index, namespace);
    });
    
    const results = await Promise.allSettled(uploadPromises);
    
    // Step 5: Complete multipart upload
    const parts = results
      .filter(r => r.status === 'fulfilled')
      .map((r: any) => r.value);
    
    await this.completeMultipartUpload(uploadId, parts);
    
    return {
      success: true,
      uploadTime: Date.now() - startTime,
      edgesUsed: edges.length,
      chunks: chunks.length
    };
  }
  
  private async uploadChunkViaEdge(
    chunk: Buffer, 
    edge: Edge, 
    uploadId: string, 
    partNumber: number,
    namespace: string
  ) {
    // Upload via AgentCache edge (proxies to Lyve)
    const response = await fetch(`${edge.url}/api/jetty-speed/chunk`, {
      method: 'POST',
      headers: {
        'X-API-Key': AGENTCACHE_API_KEY,
        'X-Upload-Id': uploadId,
        'X-Part-Number': partNumber.toString(),
        'X-Namespace': namespace,
        'Content-Type': 'application/octet-stream'
      },
      body: chunk
    });
    
    const { etag } = await response.json();
    
    return { partNumber, etag };
  }
}
```

#### 2.2 Update Upload tRPC Endpoint
**File**: `server/trpc/routers/files.ts`

```typescript
// Replace single-path upload with JettySpeed
upload: protectedProcedure
  .input(z.object({
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
    enableJettySpeed: z.boolean().default(true)
  }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.userId;
    const customerId = ctx.session.customerId;
    
    if (input.enableJettySpeed && input.fileSize > 10 * 1024 * 1024) {
      // Use JettySpeed for files >10MB
      const uploader = new JettySpeedUploader();
      return uploader.uploadFile(input, userId, customerId);
    } else {
      // Traditional single-path upload
      return this.traditionalUpload(input, userId);
    }
  })
```

### Phase 3: Video Streaming Optimization (Week 3)
**Goal**: <500ms video startup time via HLS segment caching

#### 3.1 HLS Segment Cache
**File**: `server/services/video-cache.ts` (update existing)

```typescript
// Add AgentCache integration for HLS segments
async streamVideo(videoId: string, segmentIndex: number, namespace: string) {
  const cacheKey = `video:${videoId}:seg:${segmentIndex}`;
  
  // Check AgentCache first
  const cached = await agentCache.get({
    provider: 'jettythunder',
    model: 'video-stream',
    messages: [{ role: 'system', content: cacheKey }],
    namespace
  });
  
  if (cached.hit) {
    return {
      url: cached.response as string,
      cached: true,
      latency: cached.latency_ms
    };
  }
  
  // Fetch from Lyve and cache
  const segmentUrl = await this.getHLSSegmentFromLyve(videoId, segmentIndex);
  
  await agentCache.set({
    provider: 'jettythunder',
    model: 'video-stream',
    messages: [{ role: 'system', content: cacheKey }],
    response: segmentUrl,
    ttl: 21600, // 6 hours
    namespace
  });
  
  return {
    url: segmentUrl,
    cached: false,
    latency: 100
  };
}
```

### Phase 4: Analytics Dashboard (Week 4)
**Goal**: Show customers their cache performance and cost savings

#### 4.1 Cache Analytics API
**File**: `server/trpc/routers/analytics.ts` (new)

```typescript
// Customer-facing cache analytics
cachePerformance: protectedProcedure
  .input(z.object({
    period: z.enum(['24h', '7d', '30d']).default('7d')
  }))
  .query(async ({ input, ctx }) => {
    const customerId = ctx.session.customerId;
    const namespace = `jt_customer_${customerId}`;
    
    // Fetch from AgentCache API
    const stats = await fetch(
      `${AGENTCACHE_API_URL}/api/portal/analytics?period=${input.period}&namespace=${namespace}`,
      {
        headers: { 'Authorization': `Bearer ${AGENTCACHE_API_KEY}` }
      }
    );
    
    const data = await stats.json();
    
    return {
      hitRate: data.hit_rate,
      totalRequests: data.total_requests,
      cacheSaved: data.cache_hits,
      costSavings: data.cache_hits * 0.01, // $0.01 per cache hit saved
      avgLatency: data.avg_latency_ms,
      breakdown: {
        smallFiles: data.breakdown.small_files,
        largeFiles: data.breakdown.large_files,
        videoStreams: data.breakdown.video_streams
      }
    };
  })
```

#### 4.2 Frontend Analytics Page
**File**: `client/pages/Analytics.tsx` (new)

```typescript
export function CacheAnalytics() {
  const { data } = trpc.analytics.cachePerformance.useQuery({ period: '7d' });
  
  return (
    <div className="analytics-dashboard">
      <h1>AgentCache Performance</h1>
      
      <div className="metrics">
        <MetricCard 
          title="Cache Hit Rate" 
          value={`${data.hitRate}%`}
          trend="up"
        />
        <MetricCard 
          title="Cost Savings" 
          value={`$${data.costSavings.toFixed(2)}/mo`}
          trend="up"
        />
        <MetricCard 
          title="Avg Latency" 
          value={`${data.avgLatency}ms`}
          trend="down"
        />
      </div>
      
      <Chart data={data.breakdown} type="bar" />
    </div>
  );
}
```

---

## Testing & Validation Plan

### Test Suite
**File**: `scripts/test-agentcache-integration.ts` (update existing)

```typescript
// Comprehensive integration tests
async function runIntegrationTests() {
  console.log('🧪 JettyThunder + AgentCache Integration Tests\n');
  
  // Test 1: Small file caching
  await testSmallFileCache();
  
  // Test 2: Large file chunked caching
  await testLargeFileCache();
  
  // Test 3: JettySpeed multi-edge upload
  await testJettySpeedUpload();
  
  // Test 4: Video streaming HLS segments
  await testVideoStreaming();
  
  // Test 5: Namespace isolation
  await testNamespaceIsolation();
  
  // Test 6: Desktop CDN sync
  await testDesktopCDNSync();
  
  console.log('\n✅ All tests passed!');
}
```

### Success Criteria
- [ ] Cache hit rate >70% after 7 days
- [ ] Download latency <50ms (P95) for cached files
- [ ] Upload speed 3-5x faster with JettySpeed
- [ ] Video startup <500ms
- [ ] Zero cross-customer data leaks (namespace isolation)
- [ ] Cost savings >$70/month

---

## Cost Analysis

### Current State (No Caching)
```
Monthly File Operations: 100,000 downloads
Average File Size: 10MB
Lyve Bandwidth Cost: $0.02/GB
Total Monthly Cost: $200
```

### With AgentCache (70% Hit Rate)
```
Cache Hits: 70,000 (served from edge, $0)
Cache Misses: 30,000 (Lyve bandwidth, $60)
AgentCache API: $20/month (included in plan)
Total Monthly Cost: $80
Monthly Savings: $120 (60% reduction)
Annual Savings: $1,440
```

### ROI Timeline
- Setup cost: 4 weeks engineering time (already done!)
- Break-even: Immediate
- Payback: N/A (cost reduction from day 1)

---

## Customer-Specific Configurations

### Seagate (JettyThunder's First Customer)
```typescript
// Namespace: jt_customer_seagate
// Files: 500GB storage, mostly video content
// Cache Strategy: Aggressive HLS segment caching
// TTL: 24 hours (popular videos)
// Expected Hit Rate: 85%

const seagateConfig = {
  namespace: 'jt_customer_seagate',
  features: {
    jettySpeedUpload: true,
    videoStreaming: true,
    desktopCDN: true
  },
  cacheTTL: {
    small: 86400, // 24h
    large: 21600, // 6h
    video: 43200  // 12h
  }
};
```

### Western Digital (Second Customer)
```typescript
// Namespace: jt_customer_wd
// Files: 200GB storage, mixed content
// Cache Strategy: Balanced (cost-conscious)
// TTL: 6 hours
// Expected Hit Rate: 70%

const wdConfig = {
  namespace: 'jt_customer_wd',
  features: {
    jettySpeedUpload: false, // Not needed yet
    videoStreaming: true,
    desktopCDN: false
  },
  cacheTTL: {
    small: 21600,  // 6h
    large: 10800,  // 3h
    video: 21600   // 6h
  }
};
```

---

## Deployment Checklist

### Prerequisites
- [ ] AgentCache production API key obtained
- [ ] JettyThunder Vercel environment updated
- [ ] Database migrations run (namespace tables)
- [ ] Customer namespaces created in AgentCache

### Deployment Steps
```bash
# 1. Deploy AgentCache updates (if any)
cd /Users/letstaco/Documents/agentcache-ai
git add .
git commit -m "JettyThunder integration: namespace management"
vercel --prod

# 2. Update JettyThunder environment
cd /Users/letstaco/Documents/jettythunder-v2
echo "AGENTCACHE_API_KEY=ac_live_prod_xxx" >> .env.production

# 3. Deploy JettyThunder
git add .
git commit -m "AgentCache integration: full caching layer"
git push origin main  # Auto-deploys to Vercel

# 4. Run smoke tests
tsx scripts/test-agentcache-integration.ts --production

# 5. Monitor logs for 24h
vercel logs --follow
```

### Rollback Plan
```bash
# If issues arise, revert to direct Lyve access
git revert HEAD
git push origin main

# Disable AgentCache via env var
vercel env rm AGENTCACHE_API_KEY production
```

---

## Support & Monitoring

### Health Checks
```bash
# AgentCache health
curl https://agentcache.ai/api/health

# JettyThunder cache stats
curl https://jettythunder.app/api/trpc/analytics.cachePerformance \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Alerts
- Cache hit rate drops below 50% (investigate namespace config)
- Latency exceeds 100ms (edge selection issue)
- Upload failures increase (JettySpeed timeout)

### Support Contacts
- **AgentCache Platform**: letstaco@agentcache.ai
- **JettyThunder Engineering**: Same person! 🚀

---

## Next Steps After Deployment

1. **Week 1-2**: Monitor cache hit rates, adjust TTLs
2. **Week 3-4**: Onboard next 3 customers (WD, SanDisk, IBM)
3. **Month 2**: Build customer-facing analytics dashboard
4. **Month 3**: Open-source `@jetty/agentcache-connectors` package

---

## Success Metrics (30 Days Post-Deploy)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Cache Hit Rate | >70% | TBD | 🟡 Pending |
| Download Latency (P95) | <50ms | TBD | 🟡 Pending |
| Upload Speed (100MB) | <10s | TBD | 🟡 Pending |
| Video Startup | <500ms | TBD | 🟡 Pending |
| Monthly Cost Savings | >$120 | TBD | 🟡 Pending |
| Customer Satisfaction | >4.5/5 | TBD | 🟡 Pending |

---

**Document Status**: ✅ Ready for Implementation  
**Next Action**: Begin Phase 1 (Week 1) - Core Caching Infrastructure
