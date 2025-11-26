# AgentCache.ai - Session Memory

**Last Updated:** 2025-11-26 08:17 UTC  
**Context:** Dashboard & Workspace Integration Development

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

### ✅ Authentication System (Complete)
- Email/password signup and login working
- Password reset with Resend email service
- JWT tokens (7-day expiry)
- OAuth (GitHub/Google) implemented but hidden in UI

### ✅ Database
- Neon PostgreSQL connected
- Users, pipelines, api_keys tables exist
- `get_current_month_usage()` function available
- Platform memory tables for cognitive caching

### 🚧 Dashboard Integration (In Progress)
**Goal**: Connect existing dashboard UI to database via API

**What Exists**:
- Beautiful dashboard templates in `examples/pipeline_code_and_images/`
  - PipelineDashboard.html - metrics, sidebar nav
  - analytics.html - time-series charts
  - Pipeline.html - individual pipeline view
- `/api/dashboard` endpoint created (returns user metrics, pipelines, usage)

**What's Needed**:
1. Wire up `/public/dashboard.html` to fetch from `/api/dashboard`
2. "Open in Studio" button → load pipeline into `studio.html`
3. Replace mock data with real API calls
4. Integrate WorkspaceDashboard.jsx with database backend

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
DATABASE_URL=postgresql://...neon.tech
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
JWT_SECRET=YLxoiac+t2YH9hlv8rfVnY6D1PdemhsKma1pLNEQl7E=
RESEND_API_KEY=re_...
NODE_ENV=production
GITHUB_CLIENT_ID=... (OAuth, hidden)
GITHUB_CLIENT_SECRET=... (OAuth, hidden)
GOOGLE_CLIENT_ID=... (OAuth, hidden)
GOOGLE_CLIENT_SECRET=... (OAuth, hidden)
```

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

## Next Actions
1. Fix SSL config in `lib/db.js` for local script execution
2. Wire dashboard.html to `/api/dashboard`
3. Add "load pipeline" to studio.html from URL params
4. Test JettyThunder enterprise account
5. Document workspace → node system integration

## Architecture Decisions
- **localStorage for MVP**: Current WorkspaceDashboard uses localStorage
- **Database migration planned**: Will move to PostgreSQL when needed
- **Incremental optimization**: No full rebuild, add features progressively
- **Platform Memory**: Use own cognitive caching for pattern learning
- **Sector-first design**: Everything scoped by sector (healthcare, finance, etc.)

## Contact
- User: Platform team @ jettythunder.app
- Testing email: verdoni@gmail.com
