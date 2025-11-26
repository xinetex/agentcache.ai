# AgentCache.ai - Session Memory

**Last Updated:** 2025-11-26 08:30 UTC  
**Context:** Dashboard Integration Complete - Testing Phase

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
