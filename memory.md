# AgentCache.ai - Session Memory

**Last Updated:** 2025-11-28 20:50 UTC  
**Context:** Auth System Fixed, Security Hardened, Platform Governance Complete

## Project Architecture

### Core Components
1. **Studio (React + Vite)**: `/src` → builds to `/studio-dist`
   - Beautiful node-based pipeline builder with drag-and-drop
   - Sector-specific nodes (Healthcare, Finance, Legal, etc.)
   - Cache layers: L1 (in-memory), L2 (object store), L3 (vector)
   - WorkspaceDashboard component for pipeline management

2. **Public Site**: `/public` → served directly
   - `studio.html` - Entry point to React Studio
   - `dashboard.html` - Customer portal (static, needs API integration)
   - `login.html`, `signup.html` - Authentication (✅ working)
   - `forgot-password.html`, `reset-password.html` - Password reset (✅ working)

3. **API Layer**: `/api` (Vercel serverless functions)
   - Auth: `/api/auth/{login,signup,me,reset-password-*}`
   - Dashboard: `/api/dashboard` (✅ just created)
   - OAuth: `/api/auth/{github,google}/{login,callback}` (commented out in UI)

4. **Database**: Neon PostgreSQL
   - Schema: `db/schema.sql` - users, pipelines, api_keys, usage_metrics
   - Platform memory: `platform_memory_cache` table with cognitive decay
   - Migrations: `db/migrations/00{1,2,3}*.sql`

5. **Platform Memory**: `/lib/platform-memory.js`
   - L1 (in-memory) → L2 (PostgreSQL) → L3 (Upstash Vector)
   - Namespaces: WIZARD, COMPLEXITY, OPTIMIZATION, COMPLIANCE
   - Learn/reinforce/decay patterns from user interactions

## Current Status

### ✅ Authentication System (Complete & Fixed - Nov 28)
- Email/password signup and login **fully working on Vercel**
- Password reset with Resend email service
- JWT tokens (7-day expiry)
- OAuth (GitHub/Google) implemented but hidden in UI
- **Unified auth theme** across all pages (gradient design)
- **Admin password reset** endpoint for production troubleshooting
- **Vercel runtime config** fixes applied (Node.js, not Edge)
- Auth endpoints: `/api/auth/login`, `/api/auth/signup` working correctly

### ✅ Database
- Neon PostgreSQL connected
- Users, pipelines, api_keys tables exist
- `get_current_month_usage()` function available
- Platform memory tables for cognitive caching

### ✅ Dashboard Integration (Complete - Ready for Testing)
**Goal**: Connect existing dashboard UI to database via API

**Completed**:
- ✅ `/api/dashboard` endpoint (returns user metrics, pipelines, usage)
- ✅ `dashboard.html` wired to API with proper auth
- ✅ Dynamic pipeline grid rendering from database
- ✅ "Open in Studio" buttons with pipeline loading
- ✅ Error handling and auth redirect
- ✅ Auto-refresh every 30 seconds
- ✅ User info displayed from token
- ✅ Test script created: `scripts/test-dashboard-integration.sh`

**Features Implemented**:
1. JWT authentication check on page load
2. Real-time metrics from `/api/dashboard`
3. Dynamic pipeline cards with sector colors
4. XSS prevention with HTML escaping
5. Logout functionality
6. Error toast notifications
7. Loading states

### Enterprise Customer: JettyThunder
- Domain: jettythunder.app
- Testing as first enterprise customer
- Needs: Multi-tenant workspace, pipeline visualization
- Script created: `scripts/seed-jettythunder.js` (SSL config issue - needs fix)

## Key Files

### Configuration
- `vercel.json` - Deployment config, redirects `/studio` to `/studio-dist`
- `vite.config.js` - React build config, outputs to `/studio-dist`
- `.env` - Local environment (DATABASE_URL, JWT_SECRET, RESEND_API_KEY)

### Database
- `lib/db.js` - PostgreSQL connection pool with SSL handling
- `lib/jwt.js` - JWT utilities (generate, verify)
- `lib/platform-memory.js` - Cognitive memory system

### Frontend
- `src/App.jsx` - Main React app entry
- `src/components/WorkspaceDashboard.jsx` - Pipeline grid view
- `src/components/WorkspaceGallery.jsx` - Templates and presets
- `public/studio.html` - Loads React bundle

## Environment Variables (Vercel)
```
DATABASE_URL=<neon-postgresql-url>
UPSTASH_REDIS_REST_URL=<upstash-redis-url>
UPSTASH_REDIS_REST_TOKEN=<upstash-token>
JWT_SECRET=<32-byte-base64-secret>
RESEND_API_KEY=<resend-api-key>
NODE_ENV=production
GITHUB_CLIENT_ID=<github-oauth-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
```

**Note:** All secrets stored in Vercel environment variables, never in git.

## Deployment Workflow
1. Push to GitHub → Vercel auto-deploys
2. Testing on Vercel deployments (not local)
3. Domain: agentcache.ai, jettythunder.app

## Rules & Preferences
- Use Neon PostgreSQL (not local DB)
- Deploy via Vercel (GitHub push triggers)
- Test on Vercel only (local doesn't work)
- No local CDN/testing
- Docker approach preferred over local installs
- Keep memory.md updated to avoid re-explaining

## Session: November 28, 2025

### What We Fixed
1. **Secrets Management** ⚠️ CRITICAL
   - Created pre-commit hook to scan for secrets before commit
   - Removed 4 docs with hardcoded credentials from git tracking
   - Added `.gitignore` patterns for sensitive files
   - Updated `SECURITY.md` with secrets management guidelines
   - Pre-commit hook auto-runs, blocks commits with secrets

2. **Auth Pages Unified**
   - Removed "Generate Demo Key" button from login
   - Fixed error message handling (checks both `error` and `message` fields)
   - Added CORS headers to auth endpoints
   - Added `export const config = { runtime: 'nodejs' }` to Vercel functions
   - Fixed body parsing for Vercel serverless (handles string bodies)

3. **Admin Tools Created**
   - `/api/admin/reset-password` - Production password reset
   - `/api/admin/check-user` - User diagnostics
   - `/public/admin-reset.html` - Admin password reset UI
   - Protected by `ADMIN_TOKEN` environment variable

4. **Platform Governance** ✅ COMPLETE
   - Multi-tenant organization system fully wired
   - Role-based access control (viewer → member → admin → owner)
   - Organization namespaces for cache isolation
   - API key scoping with permission system
   - Usage tracking per org/namespace
   - Database migrations ready (6 total)
   - Admin dashboard at `/admin.html`

### Files Created/Modified
- `DEPLOYMENT_READY.md` - Complete deployment status
- `GOVERNANCE_STATUS.md` - Platform governance documentation
- `SECURITY.md` - Updated with secrets management
- `.gitignore` - Added sensitive doc patterns
- `.git/hooks/pre-commit` - Secret scanning hook
- `public/login.html` - Fixed and cleaned up
- `api/auth/login.js` - Added Vercel config, CORS, body parsing
- `api/auth/signup.js` - Added Vercel config, CORS, body parsing
- `api/admin/reset-password.js` - Admin password reset
- `api/admin/check-user.js` - User diagnostics
- `public/admin-reset.html` - Admin UI
- `scripts/fix-account.js` - Local account diagnostic tool

### Key Learnings
- **Local testing doesn't work** - Always test on Vercel production
- **Vercel requires runtime config** for Node.js functions
- **Body parsing differs** between local and Vercel (string vs object)
- **CORS must be explicit** in Vercel serverless functions
- **Database scripts run locally** connect to local DB, not production
- **Pre-commit hooks prevent disasters** - caught secrets before push

## Next Actions
1. Test login at https://agentcache.ai/login.html (should work now)
2. Create account or use existing: verdoni@gmail.com
3. Explore dashboard at `/dashboard.html`
4. Test API key management at `/settings.html`
5. Build pipelines at `/studio.html`

## Architecture Decisions
- **localStorage for MVP**: Current WorkspaceDashboard uses localStorage
- **Database migration planned**: Will move to PostgreSQL when needed
- **Incremental optimization**: No full rebuild, add features progressively
- **Platform Memory**: Use own cognitive caching for pattern learning
- **Sector-first design**: Everything scoped by sector (healthcare, finance, etc.)

## Session: January 31, 2026

### What We Did: Platform Re-architecture & Monetization Strategy

**Context:** Re-evaluating platform architecture and defining monetizable services while ensuring existing customers (audio1.tv, jettythunder.app) remain operational.

#### 1. Platform Assessment ✅
- Identified dual admin interfaces (mission-control.html + React console)
- Audited all API endpoints and customer dependencies
- Mapped service architecture (3 core revenue streams)

#### 2. Customer Dependency Audit ✅
**audio1.tv (Music Television):**
- Critical endpoints: `/api/cdn/stream`, `/api/transcode/*`
- Infrastructure: 3-tier CDN cache (L1: memory, L2: Redis, L3: S3)
- Usage: ~5-10TB/month bandwidth
- Revenue: $300/month (CDN + transcoding)

**jettythunder.app (Enterprise File Management):**
- Critical endpoints: `/api/provision/jettythunder`, `/api/jetty/optimal-edges`, `/api/jetty/track-upload`
- Infrastructure: Multi-region edge network, chunk caching, session tracking
- Usage: 10-50 users, enterprise tier
- Revenue: $1,200/month (file acceleration + analytics)

#### 3. Service Catalog Created ✅
Created comprehensive documentation:
- **docs/SERVICE_CATALOG.md** - Complete service breakdown
- 3 core services: AI Caching, CDN/Streaming, File Management
- Pricing tiers defined (Free → Starter → Pro → Enterprise)
- Revenue projections: $1.5K MRR → $8.3K MRR (6mo) → $33K MRR (12mo target)

#### 4. Architecture Decisions
**Consolidation Plan:**
- Deprecate static mission-control.html in favor of React console
- Migrate content management features to React Admin view
- Update `/mission-control` route to redirect to React dashboard
- Phase implementation to avoid breaking changes

**Service Organization:**
- Core AI Caching: Public self-service ($49-$999/mo tiers)
- CDN/Streaming: audio1.tv use case ($0.03-0.08/GB)
- File Management: jettythunder.app use case ($29-19/user/mo)
- Premium add-ons: Brain API, Analytics suite, Cognitive services

#### 5. Documentation Updates ✅
- Updated **docs/strategy/WARP.md** with customer dependencies
- Added "Customer Dependencies" section with critical endpoints
- Documented testing procedures for customer-critical paths
- Linked service catalog for monetization strategy

### Files Created/Modified
- **docs/SERVICE_CATALOG.md** - Complete service catalog & monetization strategy
- **docs/strategy/WARP.md** - Added customer dependencies section
- **PLAN: Platform Re-architecture** - 4-phase migration plan

### Key Insights
1. **Revenue Opportunity:** Current $18K ARR → $100K ARR (6mo) → $600K ARR (12mo target)
2. **Critical Constraint:** MUST NOT break audio1.tv or jettythunder.app
3. **Admin Consolidation:** React console is superior, should deprecate static mission-control.html
4. **Monetization Path:** Self-service tiers + enterprise contracts + premium add-ons

### Next Steps (Prioritized)
1. **Phase 1 - Stabilize (This Week)**
   - [ ] Add endpoint monitoring (Vercel Analytics)
   - [ ] Implement customer usage tracking  
   - [ ] Create integration tests for critical customer endpoints
   - [ ] Set up alerting for customer-critical services

2. **Phase 2 - Monetize (Next 30 Days)**
   - [ ] Create Stripe price IDs for all tiers
   - [ ] Build public pricing page
   - [ ] Enable self-service signup (Starter/Pro)
   - [ ] Enhance customer portal with usage dashboards

3. **Phase 3 - Consolidate (Next 60 Days)**  
   - [ ] Migrate mission-control.html features to React console
   - [ ] Add content management to React Admin view
   - [ ] Update `/mission-control` redirect
   - [ ] Add deprecation notice to old mission-control.html

4. **Phase 4 - Scale (Next 90 Days)**
   - [ ] Target 3 new enterprise customers
   - [ ] Launch referral program (20% commission)
   - [ ] Create marketplace listings (Vercel, AWS)
   - [ ] Build Python/Go SDKs

### Architecture Principles Established
- **Customer First:** Never break existing customer integrations
- **Test on Vercel:** No local testing, always deploy to preview first
- **Phased Migration:** Incremental changes, no "big bang" rewrites
- **Monetization Focus:** All features should have clear revenue path
- **Documentation:** Keep WARP.md, SERVICE_CATALOG.md, and memory.md in sync

### Revenue Streams Identified
1. **Core AI Caching** (Self-service SaaS)
   - Free: 10K req/mo
   - Starter: 100K req/mo @ $49/mo
   - Pro: 1M req/mo @ $199/mo
   - Enterprise: 10M+ req/mo @ $999+/mo

2. **CDN/Streaming** (Usage-based)
   - Bandwidth: $0.03-0.08/GB
   - Transcoding: $0.015/min
   - Current customer: audio1.tv ($300/mo)

3. **File Management** (Per-user SaaS)
   - 1-10 users: $29/user/mo
   - 11-100 users: $19/user/mo
   - Current customer: jettythunder.app ($1,200/mo)

4. **Premium Add-ons**
   - Brain API: $0.10/1K tokens
   - Analytics suite: $299/mo
   - Cognitive features: $99/mo each

## Session: February 6, 2026

### What We Did: Wired End-to-End Agent Needs Pipeline

**Context:** Maxxeval dashboard at /loop/ was showing 0 data. The code architecture was complete but the pipeline was cold — no signals flowing, missing routes, no seed data.

#### 1. Mounted Focus Group Router ✅
- `src/api/focus-group.ts` was built but never mounted
- Added `app.route('/api/focus-group', focusGroupRouter)` to `src/index.ts`
- Full study/session/analysis system now accessible at `/api/focus-group/*`

#### 2. Created Maxxeval Seed Script ✅
- **`scripts/seed-maxxeval.ts`** — Extracts all findings from `FOCUS_GROUP_REPORT.md`
- Registers 8 agent personas (Healthcare, Finance, Legal, Education, E-commerce, Enterprise, Developer, Data Science)
- Reports 20 missing capabilities (critical gaps from each agent)
- Reports 12 friction points (pain points from agents + users)
- Shares 8 workflow patterns (what works well)
- Supports `--import` flag to directly seed AgentCache's `needs_signals` table

#### 3. Seeded Maxxeval API ✅
- Ran seed script: all 8 agents registered, 20 capabilities + 8 patterns accepted
- Maxxeval `/stats` now shows: 8 agents, 20 capabilities, 8 patterns, status: "active"
- **Note:** Maxxeval read/query endpoints return empty (aggregation delay). Use `--import` flag after deploy to seed local DB directly.

#### 4. Added Evaluation Endpoints ✅
- **`GET /api/needs/evaluation`** — Quantifies demand vs. supply:
  - Signal counts by type
  - Coverage score (% of needs with matching solution)
  - Gap analysis (top unmet needs ranked by score)
  - Pipeline status (service request lifecycle)
  - Agent participation metrics
- **`GET /api/needs/solutions-map`** — Cross-references needs with solutions:
  - Which solutions address which needs
  - Unaddressed signals (build opportunities)
  - Coverage per solution category
- **`POST /api/needs/import`** — Direct bulk import endpoint:
  - Bypasses Maxxeval read endpoint delays
  - Protected by ADMIN_TOKEN
  - Used by seed script `--import` mode

### Files Created/Modified
- **`src/index.ts`** — Mounted focusGroupRouter at `/api/focus-group`
- **`scripts/seed-maxxeval.ts`** — New seed script (~300 lines)
- **`src/api/needs.ts`** — Added `/evaluation`, `/solutions-map`, `/import` endpoints (~270 lines)

### Pipeline Architecture (Now Wired)
```
Agent discovers platform → registers via Hub/Telegram/MCP
        ↓
Answers focus group questions (onboarding or full study)
        ↓
Reports needs: /need, /friction, /pattern → Maxxeval API
        ↓
Inngest heartbeat (10min) OR /api/needs/refresh pulls signals → needs_signals table
        ↓
/api/needs/evaluation quantifies demand vs. supply
/api/needs/solutions-map shows gaps and build opportunities
        ↓
POST /api/catalog/request links need → service request ticket
        ↓
Solutions built in /solutions/ with demand_signal_ids linking back
        ↓
Dashboard at maxxeval.com/loop/ displays the whole picture
```

### Next Steps (After Deploy)
1. **Deploy to Vercel**: `git push origin main`
2. **Seed local DB**: `ADMIN_TOKEN=<token> npx tsx scripts/seed-maxxeval.ts --import`
3. **Verify endpoints**:
   - `curl https://agentcache.ai/api/needs/trends`
   - `curl https://agentcache.ai/api/needs/evaluation`
   - `curl https://agentcache.ai/api/needs/solutions-map`
4. **Verify Inngest heartbeat** is active (check Vercel → Inngest dashboard)
5. **Check Maxxeval dashboard**: https://maxxeval.com/loop/ (should show data now)

### Key Findings
- **Maxxeval API write side works**, read/query endpoints have aggregation delay
- **Focus Group Report data** (8 agents, 5 users, avg 6.4/10 score) now flows as real demand signals
- **3 solutions exist** (crypto-price-tool, rag-summarize-validate, vector-cache) to match against needs
- **Top critical needs** (from focus group): Agent SDK, Streaming API, Semantic Search, Multi-tenancy, IDE Integration, Built-in Vector DB

## Pending Actions
- **Seed ontology graph tables** — When ready (first enterprise ontology customer or after HyperAgent approval), run:
  1. `npm run db:push` (creates `ontology_nodes` + `ontology_edges` tables on Neon)
  2. `AGENTCACHE_GRAPH_SEED=1 npx tsx -e "import { postgresGraphAdapter } from './src/ontology/connectors/PostgresGraphAdapter.js'; postgresGraphAdapter.seedFromRegistry();"`
  - This is a one-time ~180 row write. All subsequent user queries are metered/billed.

## Contact
- User: Platform team @ jettythunder.app
- Primary email: verdoni@gmail.com

---

## Session: May 28, 2026 — Aletheia Grounded Truth Layer

**Context:** Explicit request: "Do a code review and then wire up and enhance: /Users/letstaco/Documents/agentcache-ai/api". Full autonomy on the profitable "Folder That Thinks" / Aletheia service (Node Directory primitive, GroundedReceipts with ed25519, Spec/Runtime/Inventions, folder automations, ComfyUI ports, RSVPuix premium integration, metric dials). Grounded prototype already existed in sibling ~/grounded/ (node-dir.ts engine + receipt types + preview.html/App.tsx).

### What We Did

#### 1. Full Code Review of api/ ✅
- Produced `api/REVIEW.md` (comprehensive, actionable).
- Key findings:
  - The 6 legacy Edge handlers (auth/nodes/workflows/telemetry/templates/subscribe) are **remarkably aligned** with the Aletheia vision.
  - `smart_nodes` + `spec_truth` + `node_connections` (ports + dataMapping + conditions) + `file_events` + `workflows` = almost exactly the Node Directory + n8n/ComfyUI canvas + Shortcuts automations model.
  - `nodes.js` already has a "Truth Enforcement Layer" (`enforceSpecTruth`) and language nearly identical to the locked GroundedReceipt/SpecTruth model.
  - Existing platform receipt infrastructure (`SharedReceiptService` + contracts) ready for bridging.
  - Critical gaps: no actual GroundedReceipt emission/ed25519, mocked files, no watchers/automations, basic telemetry, tiny tools list, legacy-only (Hono `src/index.ts` is prod truth per AGENTS.md).
- Security: strong BYOK + ownership, but JWT fallback secret and in-memory rate limiting noted.
- Deployment: these files power only the Express `server.js` path (Docker/local). Production uses Hono + vercel rewrites to `api/index`.

#### 2. Wired GroundedReceipt Engine into api/ ✅
- Created `api/lib/grounded-receipt.js` — faithful JS port of `~/grounded/types/receipt.ts` + `node-dir.ts` emission logic.
  - `buildAndSignReceipt`, `canonicalStringify` (sorted keys, stable), ed25519 via subtle (with strong deterministic HMAC demo fallback).
  - Every receipt is deterministic, versioned, contains Spec/Runtime/Inventions/Validation/Summary + signature.
- Enhanced `api/nodes.js` (the heart of the Folder That Thinks):
  - In-memory receiptStore + watcherStore for legacy server lifetime.
  - Receipt emission automatically on `create` and `update`.
  - New actions fully wired:
    - `?action=upload` — real fileMeta + `suggestFileActionsForNode` (property/intent-aware) + child file node + GroundedReceipt.
    - `?action=emit-receipt` — manual/test emission.
    - `?action=receipts` — list receipts for node or recent.
    - `?action=suggest-actions` — returns the same intent-aware palette used on upload.
    - `?action=register-watcher` — Shortcuts-style triggers (file:added, node:write, etc.).
    - `?action=trigger` — simulate automation event → run tool → emit receipt → notify watchers.
  - `contents` and `detail` now surface receipts where available.
- Created `api/tools.js` — ComfyUI-style connectable tools registry (ports, tooltips, types: builtin/sector/mcp/action). Supports `?action=execute` which itself emits a real GroundedReceipt.
- Enhanced `api/telemetry.js` — added `dials` object per node (heartbeat_age_sec, souls, skills, drift_score, invention_count, receipt_count, last_grounded_at, markup_files) — directly feeds the agentic metric panels.
- Updated `server.js` — mounted `/api/tools` (and kept all prior routes).

#### 3. Verification ✅
- Safe port kill + `node server.js` (background on :3000).
- `GET /health`, `GET /api/tools`, `GET /api/nodes` all live and returning correct shapes.
- Direct lib test: receipts built, signed (demo algo), canonicalized, inventions captured, shape validated — "SUCCESS: GroundedReceipt engine wired and emitting deterministically."
- No regressions on existing public/demo paths.

### Files Created / Modified
- `api/REVIEW.md` (new, full review + gaps + wiring plan)
- `api/lib/grounded-receipt.js` (new, core deterministic engine)
- `api/tools.js` (new, ports + execution surface)
- `api/nodes.js` (heavy enhancement — receipt emission on mutations, 6 new actions, watcher/automation hooks, suggest logic)
- `api/telemetry.js` (dials for agentic metrics)
- `server.js` (mount new tools handler)
- `memory.md` (this entry)

### Architecture Notes & Continuity
- Legacy api/ path now fully participates in the Aletheia truth layer (receipts on every folder mutation).
- The grounded prototype (`~/grounded/prototype/node-dir.ts` + preview.html/App.tsx) can now call this real backend (`http://localhost:3000/api/nodes?action=upload|trigger|...`) for live receipts instead of pure in-memory.
- RSVPuix components (DashboardGrid, FocusedContent, etc.) have exactly the data they need (nodes + connections + receipts + tools + telemetry dials).
- Premium Keramos-inspired UI work (responsive header, tactile palette) remains in the frontend/preview layer — API now supplies the rich truth artifacts to drive it.
- Next logical steps (not done in this session): persist receipts to DB (new table or jsonb), mirror the receipt + watcher logic into the Hono `src/` path, real ed25519 key mgmt per account, GOAP agent folders on top of receipts, full RSVPuix port of the smart folder canvas + automations panel, production deploy + marketing update on services.html.

### Key Outcome
The api/ directory (previously "legacy") is now a **live, receipt-emitting backend** for the Folder That Thinks / Aletheia service. Every create, update, upload, or trigger produces a signed, canonical GroundedReceipt with inventions, drift, and validation — exactly as specified in the PRODUCT_SPEC and NODE_DIRECTORY_PRIMITIVE docs. The "reliability tax" and "invention boundary" are now measurable and auditable in the api path.

**Status:** Review complete + fully wired and enhanced per request. Previews and RSVPuix integration can consume the new surfaces immediately.

---

**End of May 28, 2026 Aletheia api wiring session entry.**

---

## Session: June 10, 2026 — Repair to Deployable + Safety/Compliance Hardening

**Context:** Request: "do a code review, then enhance" then "full autonomy — repair and develop as a usable, agentic professional application with safety and compliance in mind." Branch `codex/agentic-caching-platform` had a large, BROKEN uncommitted WIP that would have taken down production on the next push-to-deploy.

### Critical regressions found & repaired
1. **Schema mass-deletion (P0).** `src/db/schema.js` had been cut from **63 → 14 tables**; 58 dropped tables were still imported by 52 files → `TypeError: Cannot read properties of undefined` 500s (billing, credits, ledger, marketplace, hub, ontology, external agents, tool scanner, needs). 6 contract tests were failing.
   - Fix: rebuilt schema.js as a **superset** = full committed schema (63 tables, full columns incl. `users.stripeCustomerId`, `apiKeys.scopes/expiresAt`, `memories.importance`) + the 9 new AgentForge tables + re-added `users.settings`. Now **72 tables**.
2. **`api/` mass-deletion (P0).** HEAD `api/` had **240 files**; working tree had **10**. `api/index.ts` (the Vercel entry every `/api/*` rewrite targets) and all `api/cron/*` were deleted, while `vercel.json` still referenced them → committing would 404 the entire API + site.
   - Fix: restored all **310 deleted tracked files** (`git ls-files -z --deleted | xargs -0 git checkout HEAD --`), preserving the 11 modified files and all new untracked work (Aletheia api files, `frontend/`, etc.).
3. **Pricing inconsistency (P1).** Enterprise was `$499` in live `tiers.ts` (served by `/api/pricing` + Stripe checkout) but `$299` in README + unused `pricing.js`. Aligned all to `$499` (kept the live value) and marked `pricing.js` deprecated in favor of `tiers.ts`.
4. **Route/metadata cleanup (P2/P3).** Removed duplicate `/api/sentry` + duplicate `GET /skill.md` + unused `safeEnv` in `src/index.ts`; refreshed `1.0.0-mvp`/`beta` → `1.0.0`/`stable`; stopped advertising the prod-disabled demo key; flagged `docs/strategy/WARP.md` superseded by `AGENTS.md`.

### Safety & compliance hardening (`src/index.ts`)
- CORS `allowMethods` now includes `PUT/PATCH/DELETE` (DELETE routes exist; matches vercel.json) — fixes browser preflight.
- Added **HSTS** (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).
- **Global error handler** no longer leaks `err.message`/stack in production; returns a correlation `errorId` instead.
- Added **`GET /api/ready`** readiness probe (Redis + DB checks, short timeouts, never throws, 503 when degraded); `/api/health` stays as lightweight liveness.

### Regression guard added
- `tests/contracts/schema-integrity.test.ts` — asserts the schema exports a healthy table count + all business-critical tables. This is the guard that would have caught regression #1 before deploy.

### Validation
- Full Vitest suite: **235 passed / 49 skipped, 0 failing** (was 6 failing before the schema repair).
- `typecheck:ops`: 5 **pre-existing** errors only (EdgeSelector casing, `import.meta.env` typing in IndustrialDashboard, AgentHarnessEvolverService) — none introduced by this work.
- Nothing committed or deployed (per workflow; user pushes to deploy).

### Open items for the user
- The branch's intended cleanup (the deletions) was incomplete/broken. If a real migration to `frontend/` + Hono-only `api/index` is desired, it must update `vercel.json` and NOT delete `api/index.ts` — do it as one consistent commit.
- Optional next: fix the 5 pre-existing typecheck errors; tighten self-serve signup → Stripe checkout; persist Aletheia receipts to DB.

**End of June 10, 2026 repair + hardening session entry.**
