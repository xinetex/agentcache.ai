# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## What is AgentCache.ai

AI middleware platform for caching, memory, and policy-safe execution. Three core products:
1. **AgentCache Core** — Semantic cache for LLM calls, tool result cache, session memory, anti-cache invalidation
2. **AgentCache Guardrails** — PII redaction, prompt validation, tool safety scanning, policy enforcement
3. **AgentCache Knowledge** — Document ingest, semantic search, persistent workspace memory

Active customers: **audio1.tv** (CDN/streaming), **jettythunder.app** (enterprise file management), and **clawsave.com** (agentic storage via JettyThunder). Changes must not break their endpoints.

## Platform Ecosystem

AgentCache.ai is the control plane for a constellation of related projects. All share Neon DB, Vercel deploys, and Seagate Lyve storage.

- **jettythunder.app** (`../jettythunder-v2`) — Enterprise file management platform. React + Express + tRPC monorepo (`pnpm`). Uses `@jetty/agentcache-connectors` workspace package to call AgentCache APIs. Endpoints like `/api/provision/jettythunder`, `/api/jetty/*`, `/api/muscle/*`, and `/api/s3/*` serve this customer.
- **audio1.tv** (`../audio1.tv`) — Music video streaming platform (web, Roku, artist studio). Relies on AgentCache for CDN streaming (`/api/cdn/*`), transcoding (`/api/transcode/*`), and brain/memory (`/api/brain/*`). HLS delivery with 3-tier cache (memory → Redis → Lyve S3).
- **hip-networks** (`../hip-networks`) — FAST (Free Ad-Supported Streaming TV) channel platform for Roku (Channel ID: 833856). Hono-based orchestrator with EPG, VMAP, and Vimeo integration. Domain ties to jettythunder.app.
- **clawsave.com** — Agentic storage product built on top of JettyThunder storage services. Routes: `/api/clawsave`, `/api/claw/*`.
- **maxxeval.com** — External demand-signal collection platform. AgentCache pulls agent needs (missing capabilities, friction points, workflow patterns) from MaxxEval's API via `src/lib/maxxeval.ts` and the Inngest heartbeat (`src/inngest/functions/agentLoop.ts`). Signals are stored locally in the `needs_signals` table.

### SDKs & Packages

- `packages/` — Multiple SDK variants: `agentcache-js`, `client`, `lite`, `node-sdk`, `cli`, `python-sdk`, `standard`
- `sdk/` — Customer-specific clients: `audio1-cdn-client.js` (JS/MJS), `audio1-cdn-roku.brs` (BrightScript for Roku), `overflow-client.js`
- `sdk-python/` — Python SDK

### Inngest (Background Jobs)

`src/inngest/` — Background job system using Inngest. The main heartbeat (`agentLoop.ts`) runs every 10 minutes: GrowthAgent scans, ResearcherAgent harvests signals, and MaxxEval needs are refreshed into the DB. Vercel crons (`vercel.json`) handle daily tasks like `/api/cron/researcher` and `/api/cron/worker`.

### Integrations

`src/integrations/` — Connectors for external AI frameworks: `vercel.ts` (Vercel marketplace integration), `langchain.ts`, `crewai.ts`.

## Commands

```bash
# Development
npm run dev              # Vite dev server (frontend)
npm run build            # Vite build + copy studio-dist to dist
npm run mcp:dev          # Run MCP server locally via tsx

# Database (Neon PostgreSQL via Drizzle ORM)
npm run db:generate      # Generate Drizzle migrations
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio GUI

# Testing (Vitest — tests run against mock DB, no real DB needed)
npm test                 # Run all tests in watch mode
npx vitest --run         # Run all tests once
npx vitest --run tests/unit/cognitive-memory.test.ts   # Run a single test file
npm run test:verification  # Run verification suite (cognitive + claims + contracts)
npm run test:ops         # Run operations scripts tests

# Type checking
npm run typecheck:ops    # Typecheck operations scripts (tsconfig.operations.json)
```

## Deployment

Push to GitHub → Vercel auto-deploys. **No local testing** — always test on Vercel deployments. The project does not connect to localhost.

## Architecture

### Dual Backend

1. **Hono App** (`src/index.ts`) — Primary backend. Exported as `app` and served through:
   - `api/index.ts` — Vercel adapter via `@hono/node-server/vercel`, all `/api/*` routes funneled here
   - `src/server.ts` — Standalone Node.js server for non-Vercel use

2. **Express Server** (`server.js`) — Legacy Docker/local server that wraps older `/api/*.js` edge functions. Used by Dockerfile.

The Hono app in `src/index.ts` is the source of truth for API routing.

### Lazy-Loaded Route Pattern

All sub-routers are lazy-loaded to minimize Vercel cold-start time:

```ts
// Pattern used throughout src/index.ts
app.all('/api/hub/:path{.+}?', lazy(() => import('./api/hub.js')));
```

The `lazy()` helper dynamically imports the module, resolves the Hono router, and forwards requests with the correct sub-path. When adding new API routes, follow this pattern.

### Database

- **Neon PostgreSQL** via `@neondatabase/serverless` (direct SQL) and **Drizzle ORM** (`drizzle-orm/postgres-js`)
- Schema: `src/db/schema.js` — all tables defined with `pgTable()` from Drizzle
- Client: `src/db/client.js` — Proxy-based lazy initialization. Falls back to an in-memory mock DB when `DATABASE_URL` is missing, in test mode (`VITEST`), or when `AGENTCACHE_FORCE_MOCK_DB=1`
- Drizzle config: `drizzle.config.ts` — points to `src/db/schema.js`, outputs to `./drizzle`
- Migrations: `drizzle/` directory

### Cache Layer

- **Upstash Redis** (`src/lib/redis.ts`) for caching, rate limiting, session storage
- Cache key format: `agentcache:v1:{provider}:{model}:{hash}` using deterministic SHA-256 from `src/lib/stable-json.ts`

### Frontend

- **Public site**: Static HTML files in `/public` (login, dashboard, pricing, admin pages)
- **Studio (React + Vite)**: Source in `/src` (App.jsx, components), builds to `/studio-dist`, then copied to `/dist` on build

### MCP Server

`src/mcp/server.ts` — Model Context Protocol server exposing caching tools via stdio transport. Tool modules registered from `src/mcp/tools/` (core, admin, cognitive, memory, lidar). Run with `npm run mcp:dev`.

### Services Layer

`src/services/` — Large service layer containing business logic. Key services:
- `SemanticCacheService.ts` — Core semantic caching with Platonic cross-provider fallback
- `PlatonicKeyService.ts` — Provider-agnostic cache keys for cross-model cache hits
- `MiniMaxProvider.ts` — Native MiniMax M2.7 support with OpenClaw optimization
- `TranscriptionService.ts` — High-speed audio/video transcription via `insanely-fast-whisper`
- `AlignmentMapService.ts` — HELIX-inspired private inference alignment maps
- `PolicyEngine.ts` — Guardrails and policy enforcement
- `BillingService.ts` / `StripeService.ts` — Billing via Stripe
- `ContentService.js` — Bento grid content management
- `cognitive-memory.ts` — Cognitive memory with decay
- `ArmorService.ts` — WAF middleware (applied globally to `/api/*`)
- `ScannerService.ts` — Tool safety scanning

### Middleware

- `src/middleware/auth.ts` — `authenticateApiKey` and `authenticateAdmin` middleware
- `src/middleware/customerUsageTracking.ts` — Usage tracking applied to all `/api/*` routes
- Armor WAF — Registered in `src/index.ts`, checks all API requests for rate limits and threat patterns

### Key Libraries

- `src/lib/llm/` — LLM provider factory, embeddings, savings tracker, token budget
- `src/lib/hub/` — Agent Hub registry and discovery (agents.json, skill.md)
- `src/lib/vector.ts` — Vector memory operations (Upstash Vector)
- `src/lib/stable-json.ts` — Deterministic JSON serialization for cache keys
- `src/lib/tierChecker.ts` — Tier-based feature gating
- `src/config/tiers.js` — Pricing tier definitions

## Environment Variables

See `.env.example` for the full list. Critical ones:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Redis cache
- `JWT_SECRET` — Auth token signing
- `ADMIN_TOKEN` — Admin API access
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Billing
- `LYVE_*` — Seagate Lyve Cloud (S3-compatible storage for CDN/files)

## Testing

- Framework: **Vitest** with Node environment
- Test locations: `tests/unit/`, `tests/claims/`, `tests/contracts/`
- DB client automatically falls back to mock in test mode — no real database connection needed
- Verification suite: `npm run test:verification` runs cognitive memory, claims, and public API contract tests

## Customer-Critical Endpoints

**audio1.tv**: `GET /api/cdn/stream`, `POST /api/transcode/submit`, `POST /api/transcribe/submit`, `GET /api/transcode/status/:jobId`
**jettythunder.app**: `POST /api/provision/jettythunder`, `GET /api/jetty/optimal-edges`, `POST /api/jetty/track-upload`, `POST /api/jetty/cache-chunk`, `POST /api/helix/infer`
**clawsave.com**: `GET /api/clawsave`, `POST /api/claw/agent`, `POST /api/claw/storage`, `POST /api/claw/provision`, `POST /api/claw/memory/*`

Customer identification is path-based — see `src/middleware/customerUsageTracking.ts` for the full endpoint-to-customer mapping. Always verify these work on Vercel preview deploys before merging changes that touch CDN, transcode, jetty, claw, or provisioning routes.

## Important Constraints

- This is an ESM project (`"type": "module"` in package.json). All imports use `.js` extensions even for TypeScript files.
- TypeScript strict mode is **off** (`"strict": false` in tsconfig.json).
- The `api/` directory contains the Vercel entry point (`api/index.ts`) plus legacy standalone edge function files. The Hono app in `src/index.ts` handles all routing — legacy `/api/*.js` files are only used by the Express `server.js`.
- The `scripts/` directory excludes from tsconfig compilation — run them with `tsx` or `node --import tsx`.
- Docker deployment uses `server.js` (Express), not the Hono server.
