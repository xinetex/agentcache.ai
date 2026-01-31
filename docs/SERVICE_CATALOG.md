# AgentCache.ai Service Catalog & Monetization Strategy

**Last Updated:** 2026-01-31  
**Status:** Active Platform Re-architecture

## Executive Summary

AgentCache.ai operates as a multi-service AI infrastructure platform with three primary revenue streams:
1. **Core Caching Service** - LLM API response caching
2. **CDN/Streaming Services** - Video/audio content delivery (audio1.tv customer)
3. **File Management Platform** - Distributed file storage and acceleration (jettythunder.app customer)

---

## Service Architecture Map

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentCache Platform                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Core AI    │  │   CDN/Media  │  │ File Storage │    │
│  │   Caching    │  │   Delivery   │  │ Acceleration │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│        │                  │                  │             │
│        ▼                  ▼                  ▼             │
│  ┌──────────────────────────────────────────────────┐     │
│  │          Shared Infrastructure Layer             │     │
│  │   • Upstash Redis (Cache L1/L2)                 │     │
│  │   • Neon PostgreSQL (Metadata/Analytics)        │     │
│  │   • Vercel Edge Network (Distribution)          │     │
│  │   • S3-Compatible Storage (Seagate Lyve)        │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Core Services Breakdown

### 1.1 AI Caching Service (Core Product)

**Description:** Semantic caching layer for LLM API calls that reduces costs by 90% and improves response times 10x.

**Endpoints:**
- `POST /api/cache/get` - Retrieve cached LLM response
- `POST /api/cache/set` - Store LLM response in cache
- `POST /api/cache/check` - Check if response is cached (with TTL)
- `POST /api/cache/semantic` - Semantic similarity search
- `POST /api/cache/invalidate` - Invalidate specific cache entries
- `GET /api/stats` - Real-time analytics (hit rate, savings, performance)

**Technology Stack:**
- Upstash Redis (edge cache)
- SHA-256 hashing for deterministic keys
- Multi-tenant namespace isolation
- Semantic vector search (Upstash Vector)

**Pricing Tiers:**
```
Free Tier:       10,000 requests/month   ($0)
Starter:         100,000 requests/month  ($49/mo)
Professional:    1M requests/month       ($199/mo)
Enterprise:      10M+ requests/month     ($999/mo + custom)
```

**Key Features by Tier:**
- Free: Demo keys, basic caching, 7-day TTL
- Starter: Custom namespaces, 30-day TTL, email support
- Pro: Semantic caching, priority support, 90-day TTL, analytics dashboard
- Enterprise: Dedicated edge nodes, custom TTL, SLA, white-label options

---

### 1.2 CDN & Streaming Services (audio1.tv)

**Description:** Edge-accelerated content delivery network for video/audio streaming with automatic transcoding.

**Customer:** audio1.tv (music television platform)

**Critical Endpoints:**
- `GET /api/cdn/stream` - Stream video/audio content
- `POST /api/cdn/warm` - Pre-warm cache for upcoming content
- `GET /api/cdn/status` - CDN health and metrics
- `POST /api/transcode/submit` - Submit video for transcoding
- `GET /api/transcode/status/:jobId` - Get transcoding job status
- `GET /api/transcode/jobs` - List all transcoding jobs

**Infrastructure:**
- L1 Cache: 100MB in-memory (5 min TTL)
- L2 Cache: Redis (1 hour TTL)
- L3 Storage: S3-compatible (Seagate Lyve)
- Transcoder: Custom service (HLS, multiple bitrates)

**Service Features:**
- Automatic HLS transcoding (240p, 360p, 720p, 1080p)
- Smart poster/thumbnail generation
- Multi-region edge distribution
- Adaptive bitrate streaming
- Cache warming for live events

**Pricing Model:**
```
Bandwidth Tiers:
- 0-1TB/month:      $0.08/GB
- 1-10TB/month:     $0.05/GB  
- 10-50TB/month:    $0.03/GB
- 50TB+/month:      Custom pricing

Transcoding:
- $0.015 per minute of source video
- Includes 4 output qualities (240p-1080p)
```

**Customer Contract (audio1.tv):**
- Current usage: ~5-10TB/month
- Estimated cost: $250-500/month
- Services: CDN streaming, transcoding, thumbnail generation

---

### 1.3 File Management & Acceleration (jettythunder.app)

**Description:** Distributed file storage platform with intelligent edge routing and multi-region acceleration.

**Customer:** jettythunder.app (enterprise file management)

**Critical Endpoints:**
- `POST /api/muscle/plan` - GOAP planning for file operations
- `POST /api/muscle/reflex` - Swarm coordination
- `POST /api/provision/jettythunder` - Provision enterprise keys
- `GET /api/provision/:api_key` - Get API key info
- `GET /api/jetty/user-stats` - User performance statistics
- `POST /api/jetty/cache-chunk` - Cache file chunks
- `GET /api/jetty/optimal-edges` - Get optimal edge nodes
- `POST /api/jetty/check-duplicate` - Deduplication check
- `POST /api/jetty/track-upload` - Track upload sessions
- `GET /api/s3/presigned` - Generate presigned S3 URLs

**Infrastructure:**
- Edge node network (multi-region)
- Redis-based chunk caching
- PostgreSQL for session tracking
- S3-compatible storage backend

**Service Features:**
- Intelligent edge routing (latency optimization)
- File deduplication
- Multi-part upload acceleration
- Real-time performance analytics
- Swarm coordination for distributed operations
- GOAP (Goal-Oriented Action Planning) for autonomous file operations

**Pricing Model:**
```
Storage + Bandwidth:
- $0.023/GB/month storage
- $0.05/GB egress bandwidth
- Free ingress (uploads)

Acceleration Features:
- Basic (2x speed):     Included
- Pro (5x speed):       +$0.01/GB
- Enterprise (10x):     +$0.02/GB

Per-User Pricing:
- 1-10 users:     $29/user/month
- 11-100 users:   $19/user/month  
- 100+ users:     Custom enterprise pricing
```

**Customer Contract (jettythunder.app):**
- Current setup: Enterprise tier (master key)
- Estimated users: 10-50
- Services: File acceleration, edge routing, analytics, provisioning
- Estimated cost: $500-2000/month

---

## 2. Supporting Services (Monetizable)

### 2.1 Brain API (AI Processing)

**Description:** Vercel AI Gateway integration with Moonshot (Kimi K2) for content analysis and reasoning.

**Endpoints:**
- `GET /api/brain/health` - Health check
- `POST /api/brain/*` - AI processing requests

**Use Cases:**
- Content analysis for audio1.tv (metadata extraction)
- File classification for jettythunder.app
- Intelligent routing decisions

**Pricing:**
- Bundled with enterprise plans
- Or: $0.10 per 1,000 tokens processed

---

### 2.2 Portal & Admin Services

**Description:** Customer-facing dashboard and management APIs.

**Endpoints:**
- `GET /api/portal/dashboard` - Customer dashboard data
- `GET /api/portal/keys` - API key management
- `GET /api/portal/namespaces` - Namespace management
- `GET /api/portal/pipelines` - Pipeline management
- `POST /api/portal/provision` - Self-service provisioning
- `GET /api/portal/dedup-savings` - Deduplication savings report

**Value Proposition:**
- Self-service management reduces support costs
- Real-time analytics for ROI demonstration
- Usage tracking and billing transparency

---

### 2.3 Advanced Features (Premium Add-ons)

#### Cognitive Services
- `POST /api/cognitive/stream` - Streaming AI responses
- `POST /api/cognitive/predictions` - Predictive caching
- `POST /api/cognitive/compress` - Context compression

**Pricing:** +$99/month per feature

#### Analytics & Intelligence
- `GET /api/qchannel/*` - Advanced analytics suite
  - Feed intelligence
  - Predictive analytics
  - Voice processing
  - Visual analytics
  - Real-time briefings

**Pricing:** $299/month for full analytics suite

---

## 3. Customer Dependencies Matrix

### audio1.tv Dependencies

| Service | Criticality | Endpoint(s) | SLA Required |
|---------|-------------|-------------|--------------|
| CDN Streaming | **CRITICAL** | `/api/cdn/stream` | 99.9% uptime |
| Transcoding | **HIGH** | `/api/transcode/*` | <5 min processing |
| Cache Warming | Medium | `/api/cdn/warm` | Best effort |
| Thumbnail Gen | Medium | `/api/cdn/stream` (posters) | 95% uptime |
| Brain AI | Low | `/api/brain/*` | Best effort |

**Must Not Break:**
- `/api/cdn/stream` - Core playback functionality
- `/api/transcode/submit` - New content ingestion
- `/api/transcode/status/:jobId` - Status polling

---

### jettythunder.app Dependencies

| Service | Criticality | Endpoint(s) | SLA Required |
|---------|-------------|-------------|--------------|
| File Provisioning | **CRITICAL** | `/api/provision/jettythunder` | 99.9% uptime |
| Edge Routing | **CRITICAL** | `/api/jetty/optimal-edges` | <100ms response |
| Upload Tracking | **HIGH** | `/api/jetty/track-upload` | 99.5% uptime |
| Chunk Caching | **HIGH** | `/api/jetty/cache-chunk` | 99% uptime |
| User Stats | Medium | `/api/jetty/user-stats` | 95% uptime |
| Deduplication | Medium | `/api/jetty/check-duplicate` | Best effort |
| Muscle/GOAP | Low | `/api/muscle/*` | Best effort |

**Must Not Break:**
- `/api/provision/jettythunder` - Master key generation
- `/api/jetty/optimal-edges` - Core routing logic
- `/api/jetty/track-upload` - Session management

---

## 4. Revenue Projections

### Current State (January 2026)
```
audio1.tv:          $300/month  (CDN + transcoding)
jettythunder.app:   $1,200/month (Enterprise file platform)
─────────────────────────────────────────────────
Monthly Recurring:  $1,500/month
Annual Run Rate:    $18,000/year
```

### 6-Month Projection
```
Assumptions:
- 2 new enterprise customers (similar to jettythunder.app)
- 10 professional tier customers
- 50 starter tier customers

audio1.tv:          $300/month
jettythunder.app:   $1,200/month
New Enterprise x2:  $2,400/month
Professional x10:   $1,990/month
Starter x50:        $2,450/month
─────────────────────────────────────────────────
Monthly Recurring:  $8,340/month
Annual Run Rate:    $100,080/year
```

### 12-Month Target
```
Target: $50,000 MRR ($600K ARR)

Customer Mix:
- 5 Enterprise customers @ $1,200/mo = $6,000
- 50 Professional @ $199/mo = $9,950
- 200 Starter @ $49/mo = $9,800
- CDN/Media customers (5) @ $500/mo = $2,500
- Enterprise add-ons = $5,000
─────────────────────────────────────────────────
Total MRR Target: $33,250/month
```

---

## 5. Monetization Strategy

### Phase 1: Stabilize & Document (Current)
✅ Audit existing customer dependencies  
✅ Document all service endpoints  
✅ Create service catalog  
⏳ Add integration tests for critical paths  
⏳ Implement usage tracking per customer  

### Phase 2: Self-Service (Q1 2026)
- Launch public pricing page
- Enable self-service signup (Starter/Pro tiers)
- Stripe integration for automated billing
- Customer portal with usage dashboards
- API key management UI

### Phase 3: Scale Sales (Q2 2026)
- Target 3 enterprise customers (outreach)
- Launch referral program (20% commission)
- Create marketplace listings (Vercel, AWS)
- Partner with AI agent frameworks
- Content marketing (case studies)

### Phase 4: Platform Expansion (Q3 2026)
- Launch Python/Go SDKs
- Add self-hosted option (Enterprise)
- White-label offering
- Reseller program
- International expansion (EU, Asia)

---

## 6. Competitive Positioning

### Core AI Caching
**Competitors:** Redis, CloudFlare AI Cache, custom solutions  
**Advantage:** 
- 10x faster than building in-house
- 90% cost reduction proven
- Multi-tenant namespace isolation
- Semantic search capabilities

### CDN/Streaming
**Competitors:** Cloudflare Stream, Mux, AWS CloudFront  
**Advantage:**
- Integrated transcoding
- Smart cache warming
- Lower pricing ($0.03-0.08/GB vs $0.10-0.20/GB)
- AI-powered content optimization

### File Management
**Competitors:** Dropbox Business, Box, Egnyte  
**Advantage:**
- 10x faster uploads (edge acceleration)
- Intelligent deduplication
- GOAP-based automation
- Developer-first API

---

## 7. Key Metrics to Track

### Business Metrics
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Churn Rate
- Net Revenue Retention

### Technical Metrics
- API uptime (per endpoint)
- Cache hit rate (target: >80%)
- P95 latency (target: <50ms)
- Bandwidth usage per customer
- Storage utilization

### Customer Success Metrics
- Time to first value (<5 minutes)
- API key activations
- Support ticket volume
- Feature adoption rate
- NPS score

---

## 8. Action Items

### Immediate (Next 7 Days)
- [x] Document customer dependencies
- [x] Create service catalog
- [ ] Add endpoint monitoring (Vercel Analytics)
- [ ] Implement customer usage tracking
- [ ] Create Stripe price IDs
- [ ] Update WARP.md with customer endpoints

### Short-term (Next 30 Days)
- [ ] Launch public pricing page
- [ ] Enable self-service signup
- [ ] Build customer portal enhancements
- [ ] Add integration tests for critical endpoints
- [ ] Create sales collateral (one-pagers)
- [ ] Set up customer success workflows

### Medium-term (Next 90 Days)
- [ ] Onboard 3 new paying customers
- [ ] Launch referral program
- [ ] Create marketplace listings
- [ ] Build Python SDK
- [ ] Implement white-label options
- [ ] Expand edge network (2 new regions)

---

## 9. Risk Mitigation

### Technical Risks
**Risk:** Audio1.tv streaming downtime  
**Mitigation:** Multi-region failover, 99.9% SLA, real-time monitoring

**Risk:** JettyThunder data loss  
**Mitigation:** Triple replication, daily backups, disaster recovery plan

**Risk:** Redis capacity limits  
**Mitigation:** Auto-scaling, cache eviction policies, usage alerts

### Business Risks
**Risk:** Customer churn due to pricing  
**Mitigation:** Transparent ROI dashboards, flexible contracts, success team

**Risk:** Competitive undercutting  
**Mitigation:** Value-add features (AI, analytics), customer lock-in via integrations

**Risk:** Infrastructure costs > revenue  
**Mitigation:** Usage-based pricing, cost monitoring, efficiency optimization

---

## Appendix A: API Endpoint Inventory

### Core Caching (`/api/cache/*`)
- `GET` /cache/get - Retrieve cached response
- `POST` /cache/set - Store response
- `POST` /cache/check - Check cache status
- `POST` /cache/semantic - Semantic search
- `POST` /cache/invalidate - Invalidate entries

### CDN (`/api/cdn/*`)
- `GET` /cdn/stream - Stream content
- `POST` /cdn/warm - Pre-warm cache
- `GET` /cdn/status - Health check

### Transcoding (`/api/transcode/*`)
- `POST` /transcode/submit - Submit job
- `GET` /transcode/status/:jobId - Get status
- `GET` /transcode/jobs - List jobs
- `POST` /transcode/cancel/:jobId - Cancel job

### JettyThunder (`/api/jetty/*`, `/api/muscle/*`)
- `GET` /jetty/user-stats - User statistics
- `POST` /jetty/cache-chunk - Cache file chunk
- `GET` /jetty/optimal-edges - Get edge nodes
- `POST` /jetty/check-duplicate - Dedup check
- `POST` /jetty/track-upload - Track upload
- `POST` /muscle/plan - GOAP planning
- `POST` /muscle/reflex - Swarm control

### Provisioning (`/api/provision/*`)
- `POST` /provision - Create new client
- `GET` /provision/:api_key - Get key info
- `POST` /provision/jettythunder - JettyThunder provisioning

### Portal (`/api/portal/*`)
- `GET` /portal/dashboard - Customer dashboard
- `GET` /portal/keys - API keys
- `GET` /portal/namespaces - Namespaces
- `GET` /portal/pipelines - Pipelines
- `POST` /portal/provision - Self-provision
- `GET` /portal/dedup-savings - Dedup report

### Brain (`/api/brain/*`)
- `GET` /brain/health - Health check
- `POST` /brain/* - AI processing

### Admin (`/api/_admin/*`, `/api/admin-stats`)
- `GET` /admin-stats - Platform statistics
- `POST` /_admin/set-tier - Change customer tier
- `GET` /_admin/check-user - User diagnostics
- `POST` /_admin/reset-password - Password reset
- `GET` /_admin/customers - List customers
- `POST` /_admin/cache-warm - Warm cache
- `GET` /_admin/audit-export - Export audit logs

### Analytics (`/api/qchannel/*`)
- `GET` /qchannel/analytics - Analytics data
- `GET` /qchannel/feed - Feed intelligence
- `GET` /qchannel/predictions - Predictions
- `GET` /qchannel/briefing - Daily briefing
- `GET` /qchannel/voice - Voice analytics
- `GET` /qchannel/visuals - Visual analytics
- `GET` /qchannel/intelligence - Intelligence dashboard

---

**Document Owner:** Platform Team  
**Last Review:** 2026-01-31  
**Next Review:** 2026-02-14
