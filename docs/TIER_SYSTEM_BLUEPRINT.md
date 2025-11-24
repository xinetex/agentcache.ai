# AgentCache Tier System Blueprint
**Strategic Document - Complete Implementation Plan**

## Executive Summary

Transform AgentCache from a single product into a **three-tier ecosystem** that captures users at every stage:

1. **AgentCache Lite** (Free) - Viral entry point, zero friction
2. **AgentCache Standard** ($29-99/mo) - Production-ready persistence
3. **AgentCache Professional** ($199+/mo) - Industrial-grade with wizards

**Key Innovation:** "Nuclear power plant behind a light switch" UX - simple interface concealing massive capability.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Entry Points                     │
├──────────────┬─────────────────┬────────────────────────┤
│ NPM Package  │   Landing Page  │  API Documentation     │
│ (Lite)       │   (All Tiers)   │  (Standard/Pro)        │
└──────┬───────┴────────┬────────┴───────────┬────────────┘
       │                │                     │
       ▼                ▼                     ▼
┌──────────────┐ ┌─────────────┐  ┌─────────────────────┐
│ Lite Package │ │ Web Console │  │ Enterprise Console  │
│ (In-memory)  │ │ (Dashboard) │  │ (Wizards + Control) │
└──────┬───────┘ └──────┬──────┘  └──────┬──────────────┘
       │                │                  │
       │    ┌───────────┴──────────────────┴─────────┐
       │    │      Upgrade Intelligence Layer        │
       │    │  - Usage tracking                      │
       │    │  - Wizard recommendations              │
       │    │  - Auto-tier suggestions               │
       │    └───────────┬────────────────────────────┘
       │                │
       ▼                ▼
┌──────────────────────────────────────────────────────────┐
│              Unified Backend Services                     │
├────────────┬──────────────┬───────────────┬─────────────┤
│ Redis      │ Vector DB    │ Edge Network  │ Wizards     │
│ (Standard) │ (Pro)        │ (All)         │ (Pro)       │
└────────────┴──────────────┴───────────────┴─────────────┘
```

---

## Tier 1: AgentCache Lite

### Purpose
**Viral distribution** - Get developers hooked with zero friction, then upgrade them.

### Location
`/packages/lite/` (already created)

### Features
- ✅ Zero dependencies (50KB package)
- ✅ In-memory LRU cache
- ✅ 100 entry limit (configurable)
- ✅ TTL support
- ✅ Simple API (`get`, `set`, `check`, `getStats`)
- ✅ Telemetry (opt-in) for upgrade signals
- ✅ Namespace support (multi-tenant)

### Distribution
- NPM: `@agentcache/lite`
- GitHub README example
- "Try it free" CTA on website
- Developer docs: `/docs.html#lite`

### Upgrade Triggers
```typescript
// Built into Lite package
if (stats.evictions > 10 && stats.hitRate > 50 && stats.totalRequests > 1000) {
  console.log('🚀 Upgrade to Standard for persistence + unlimited cache');
}
```

### Migration Path
```typescript
// Before (Lite)
import { AgentCacheLite } from '@agentcache/lite';
const cache = new AgentCacheLite();

// After (Standard) - ONE LINE CHANGE
import { AgentCache } from '@agentcache/standard';
const cache = new AgentCache({ apiKey: 'ac_live_xxx' });
// API stays the same!
```

---

## Tier 2: AgentCache Standard

### Purpose
**Production workhorse** - Persistent, scalable, shared cache for serious projects.

### Location
`/packages/standard/` (needs creation)

### Features
- Redis-backed persistence (Upstash)
- Unlimited cache entries
- Shared cache across instances
- Edge network (<50ms latency)
- Analytics dashboard
- Email support

### Pricing
- **Indie**: $29/mo - 25K requests
- **Startup**: $99/mo - 150K requests
- **Growth**: $199/mo - 500K requests

### Implementation Components

#### 1. NPM Package (`@agentcache/standard`)
```typescript
// /packages/standard/src/index.ts
export class AgentCache {
  constructor(config: {
    apiKey: string;
    endpoint?: string;  // defaults to agentcache.ai
    namespace?: string;
  }) {}
  
  async get(params) {
    // Call /api/cache/get
  }
  
  async set(params, value, options) {
    // Call /api/cache/set
  }
  
  async check(params) {
    // Call /api/cache/check
  }
  
  async getStats(timeRange?) {
    // Call /api/stats
  }
}
```

#### 2. Backend API (Already exists)
- `/api/cache.js` - Main caching endpoints
- `/api/stats.js` - Analytics
- `/api/subscribe.js` - Signup flow
- `/api/verify.js` - Email verification

#### 3. Dashboard (`/dashboard.html`)
**New file needed** - User workspace showing:
- Real-time hit rate chart
- Cost savings calculator
- Request volume graph
- Top cached prompts
- Upgrade CTA to Professional

---

## Tier 3: AgentCache Professional

### Purpose
**Enterprise powerhouse** - Full industrial-grade system with wizard intelligence.

### Location
- Backend wizards: `/src/wizards/`
- Frontend: `/console.html` (enterprise console)

### Features
- Everything in Standard, plus:
- **Wizard System** - AI-powered optimization
- Vector DB for semantic caching
- Multi-model swarm orchestration
- Custom edge deployment
- Priority support + Slack channel
- ROI guarantees

### Pricing
- **Professional**: $199/mo base + usage
- **Enterprise**: Custom (starts $2K/mo)

### Wizard System Architecture

```
┌─────────────────────────────────────────────────────┐
│              Wizard Orchestrator                     │
│  - Analyzes usage patterns                          │
│  - Recommends which wizard to run                   │
│  - Tracks wizard execution history                  │
└────────────┬────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌────────────┐  ┌─────────────────┐
│ Onboarding │  │ Performance     │
│ Wizard     │  │ Wizard          │
├────────────┤  ├─────────────────┤
│ - Estimate │  │ - Analyze hit   │
│   usage    │  │   rates         │
│ - Suggest  │  │ - Optimize TTL  │
│   tier     │  │ - Find patterns │
│ - Setup    │  │ - Cost analysis │
│   keys     │  └─────────────────┘
└────────────┘
    │                 │
    ▼                 ▼
┌────────────┐  ┌─────────────────┐
│Integration │  │ Scaling         │
│Wizard      │  │ Wizard          │
├────────────┤  ├─────────────────┤
│ - Connect  │  │ - Capacity      │
│   OpenAI   │  │   planning      │
│ - Connect  │  │ - Auto-scale    │
│   Claude   │  │   rules         │
│ - Test     │  │ - Load balance  │
│   setup    │  └─────────────────┘
└────────────┘
    │                 │
    ▼                 ▼
┌────────────┐  ┌─────────────────┐
│Cost Opt    │  │ Custom          │
│Wizard      │  │ Wizard Builder  │
├────────────┤  ├─────────────────┤
│ - Identify │  │ - User creates  │
│   waste    │  │   workflow      │
│ - Suggest  │  │ - Save/share    │
│   changes  │  │ - Marketplace   │
│ - 20% fee  │  └─────────────────┘
│   on saves │
└────────────┘
```

### Wizard Pricing Model
- **Base tier includes:** Onboarding, Performance, Integration wizards (unlimited)
- **Add-ons:**
  - Scaling Wizard: $50/analysis
  - Cost Optimization: 20% of monthly savings
  - Custom Wizard: $500 one-time build
  - Wizard Marketplace: Revenue share (70/30)

---

## Implementation Phases

### Phase 1: Complete Lite Package (DONE ✅)
- [x] Core LRU cache implementation
- [x] Package.json + TypeScript config
- [x] Comprehensive README
- [x] Examples directory
- [ ] Build and publish to NPM

### Phase 2: Wire Up Standard Package (Next 4 hours)
1. Create `/packages/standard/` structure
2. Build NPM client that calls existing API
3. Add authentication layer (API key validation)
4. Create basic dashboard at `/dashboard.html`
5. Update landing page with tier comparison

### Phase 3: Wizard Foundation (6 hours)
1. Create `/src/wizards/base.ts` - Abstract wizard class
2. Implement Onboarding Wizard (simplest)
3. Add wizard routing in `/api/wizards.js`
4. Create enterprise console UI `/console.html`
5. Add wizard execution tracking to database

### Phase 4: Advanced Wizards (8 hours)
1. Performance Wizard - analyze cache patterns
2. Integration Wizard - test API connections
3. Scaling Wizard - capacity planning
4. Cost Optimization Wizard - savings finder

### Phase 5: Dashboard Excellence (4 hours)
**The "nuclear power plant" UI**
- Simple chat interface on top
- Powerful controls underneath
- Real-time visualizations
- Wizard recommendations
- One-click upgrades

---

## File Structure

```
agentcache-ai/
├── packages/
│   ├── lite/                    ✅ DONE
│   │   ├── src/index.ts
│   │   ├── package.json
│   │   ├── README.md
│   │   └── examples/basic.ts
│   │
│   └── standard/                ⏳ TODO
│       ├── src/
│       │   ├── index.ts         # Main client
│       │   ├── http.ts          # API wrapper
│       │   └── types.ts         # TypeScript types
│       ├── package.json
│       ├── README.md
│       └── examples/
│
├── src/
│   ├── wizards/                 ⏳ TODO
│   │   ├── base.ts              # Abstract wizard
│   │   ├── onboarding.ts
│   │   ├── performance.ts
│   │   ├── integration.ts
│   │   ├── scaling.ts
│   │   └── cost-optimization.ts
│   │
│   └── lib/
│       └── wizard-orchestrator.ts
│
├── api/
│   ├── cache.js                 ✅ EXISTS
│   ├── stats.js                 ✅ EXISTS
│   ├── subscribe.js             ✅ EXISTS
│   └── wizards.js               ⏳ TODO
│
├── public/
│   ├── index.html               ✅ EXISTS
│   ├── pricing.html             ✅ EXISTS
│   ├── dashboard.html           ⏳ TODO - Standard tier
│   └── console.html             ⏳ TODO - Professional tier
│
└── docs/
    ├── TIER_SYSTEM_BLUEPRINT.md ✅ THIS FILE
    └── WIZARD_DEVELOPMENT.md    ⏳ TODO
```

---

## Database Schema Extensions

### New Tables for Wizard System

```sql
-- Wizard executions
CREATE TABLE wizard_executions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  wizard_type VARCHAR(50), -- 'onboarding', 'performance', etc.
  input_data JSONB,
  output_data JSONB,
  status VARCHAR(20), -- 'running', 'completed', 'failed'
  execution_time_ms INTEGER,
  cost DECIMAL(10,2), -- If wizard charges
  created_at TIMESTAMP DEFAULT NOW()
);

-- Wizard recommendations
CREATE TABLE wizard_recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  wizard_type VARCHAR(50),
  recommendation TEXT,
  priority VARCHAR(10), -- 'low', 'medium', 'high'
  is_accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tier tracking
CREATE TABLE tier_changes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  from_tier VARCHAR(20),
  to_tier VARCHAR(20),
  reason VARCHAR(100), -- 'manual', 'wizard_recommend', 'usage_limit'
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Landing Page Updates

### Pricing Section (add to `/public/pricing.html`)

```html
<div class="grid md:grid-cols-3 gap-8">
  <!-- Lite -->
  <div class="glass rounded-2xl p-8">
    <h3 class="text-2xl font-bold">Lite</h3>
    <p class="text-4xl font-bold my-4">$0<span class="text-lg">/forever</span></p>
    <ul class="space-y-3 mb-8">
      <li>✅ In-memory cache</li>
      <li>✅ 100 entries</li>
      <li>✅ Zero dependencies</li>
      <li>✅ Perfect for dev/testing</li>
    </ul>
    <a href="#" class="btn-outline">npm install @agentcache/lite</a>
  </div>
  
  <!-- Standard -->
  <div class="glass rounded-2xl p-8 border-2 border-cyan-500">
    <div class="badge">Most Popular</div>
    <h3 class="text-2xl font-bold">Standard</h3>
    <p class="text-4xl font-bold my-4">$29<span class="text-lg">/mo</span></p>
    <ul class="space-y-3 mb-8">
      <li>✅ Redis persistence</li>
      <li>✅ Unlimited entries</li>
      <li>✅ 25K requests/mo</li>
      <li>✅ Analytics dashboard</li>
      <li>✅ Email support</li>
    </ul>
    <a href="/login.html" class="btn-primary">Get Started</a>
  </div>
  
  <!-- Professional -->
  <div class="glass rounded-2xl p-8">
    <h3 class="text-2xl font-bold">Professional</h3>
    <p class="text-4xl font-bold my-4">$199<span class="text-lg">/mo</span></p>
    <ul class="space-y-3 mb-8">
      <li>✅ Everything in Standard</li>
      <li>✅ AI Wizard system</li>
      <li>✅ Vector semantic cache</li>
      <li>✅ 500K requests/mo</li>
      <li>✅ Priority support</li>
      <li>✅ ROI guarantees</li>
    </ul>
    <a href="/login.html" class="btn-primary">Start Free Trial</a>
  </div>
</div>
```

---

## Revenue Projections

### Monthly Targets

**Month 1-3 (Lite Distribution)**
- Goal: 1,000 NPM installs
- Conversions: 2% to Standard ($29) = 20 users = $580/mo
- **MRR: $580**

**Month 4-6 (Standard Growth)**
- Goal: 5,000 NPM installs, 200 Standard users
- Standard: 150 x $29 = $4,350
- Pro upgrades: 50 x $199 = $9,950
- **MRR: $14,300**

**Month 7-12 (Professional + Wizards)**
- NPM installs: 20,000
- Standard: 500 x $29 = $14,500
- Professional: 200 x $199 = $39,800
- Wizard add-ons: ~$5,000
- **MRR: $59,300**

**Year 2 Target**
- **MRR: $100K** (sustainable SaaS business)

---

## Competitive Moat

### Why users won't churn:

1. **Lite → Standard migration is 1 line of code**
   - Switching cost is effectively zero
   - But switching *away* requires rewriting

2. **Wizard intelligence is proprietary**
   - Can't replicate the ML optimization models
   - Network effects: gets smarter with more users

3. **Integration depth**
   - Pre-built connectors for 20+ LLM providers
   - Maintaining these = ongoing engineering cost

4. **Data lock-in (ethical)**
   - Cache performance data is valuable
   - Exporting to competitors = losing optimization history

---

## Next Immediate Actions

### Today (Next 4 hours):
1. ✅ Finish Lite package build
2. ✅ Publish `@agentcache/lite` to NPM
3. ⏳ Create `/packages/standard/` skeleton
4. ⏳ Build Standard NPM client
5. ⏳ Add tier comparison to landing page

### Tomorrow:
1. Wire up Standard package to existing API
2. Create `/dashboard.html` for Standard users
3. Add Stripe integration for paid tiers
4. Deploy updated landing page

### This Week:
1. Start wizard foundation
2. Implement Onboarding Wizard
3. Create `/console.html` for Professional
4. Launch beta program

---

## Success Metrics

### Lite Package
- NPM downloads/week
- GitHub stars
- Telemetry opt-in rate
- Upgrade recommendations shown

### Standard Tier
- Monthly Active Users (MAU)
- Average requests per user
- Cache hit rate (should be >60%)
- Churn rate (target <5%/month)

### Professional Tier
- Wizard execution count
- Average savings per wizard
- Custom wizard requests
- Enterprise conversions

---

## Marketing Strategy

### Lite Package Launch
- Post to r/javascript, r/reactjs, r/node
- Tweet thread showing 3-line integration
- Dev.to article: "Stop paying for duplicate AI calls"
- Hacker News: "Show HN: Free LRU cache for AI responses"

### Standard Tier
- Case studies showing cost savings
- ROI calculator on website
- Email drip campaign for Lite users hitting limits
- Integration guides for popular frameworks

### Professional Tier
- Enterprise sales outreach
- Webinars on AI cost optimization
- Partnership with AI agent platforms
- Conference speaking (AI Engineer Summit)

---

## Risk Mitigation

### Technical Risks
- **Redis costs scale with usage** → Volume discounts with Upstash
- **Edge network expensive** → Use Cloudflare Workers R2
- **Wizard ML models costly** → Cache wizard results, batch inference

### Business Risks
- **Free tier cannibalizes paid** → Strict limits on Lite (100 entries)
- **Competitors copy** → Patent wizard orchestration logic
- **Users don't upgrade** → Built-in telemetry + proactive outreach

---

## Conclusion

This three-tier system creates a **viral growth flywheel**:

1. Developers discover Lite (free, easy)
2. They get value (cache hits = cost savings)
3. They hit limits or need persistence
4. Upgrade to Standard (one line change)
5. They scale and need optimization
6. Upgrade to Professional (wizards)
7. They recommend AgentCache to peers
8. Loop repeats

**Timeline to $100K MRR: 18 months**

Ready to build? Let's start with Phase 2.
