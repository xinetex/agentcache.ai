# AgentCache Agentic Readiness Blueprint (200-Point)

## Purpose

This document is the operating blueprint for evaluating whether AgentCache.ai is truly ready for the agentic world.

It is designed to answer five practical questions:

1. Can AgentCache provide durable infrastructure services to agents?
2. Can agents discover, provision, authenticate to, and reliably use those services?
3. Can AgentCache meter, bill, receipt, and govern those services safely?
4. Can the surrounding project constellation support real customer and agent workloads?
5. What must be true before AgentCache can claim production-grade agentic commerce?

This is intentionally a 200-point system, organized as 20 workstreams with 10 criteria each.

## How To Use This Blueprint

Each criterion is worth 1 point.

Use the following status values:

- `Implemented`: fully working in production or verifiably wired end-to-end
- `Partial`: code exists, but the workflow is incomplete, permissive, or only partially validated
- `Missing`: the capability is absent
- `Unverified`: likely present, but not confirmed by code, deploy evidence, or tests

Suggested scoring:

- `Implemented` = 1.0
- `Partial` = 0.5
- `Missing` = 0.0
- `Unverified` = 0.25

Suggested readiness bands:

- `0-79`: concept or prototype
- `80-119`: usable platform with significant gaps
- `120-159`: production-capable in selected lanes
- `160-184`: broadly production-ready
- `185-200`: operator-grade, agent-commerce ready

## Evidence Standards

A criterion should not be marked `Implemented` unless at least one of these exists:

- a working route or service in code
- a passing contract/integration test
- a verified deploy target and runtime path
- a working customer path
- an auditable billing, receipt, or policy trail

## Confirmed System Map

### Control Plane

- Repo: `agentcache-ai`
- Domain/Product: `agentcache.ai`
- Vercel project: `agentcache-ai`
- Vercel project id: `prj_cPd0LCnDxoymuOZG2G71tq3c6l8M`
- Role: control plane for cache, memory, guardrails, receipts, billing, provisioning, and agent-facing APIs

### Related Projects Confirmed In Workspace

1. Repo: `../audio1.tv`
   Domain/Product: `audio1.tv`
   Vercel project: `audio1-channel-manager`
   Vercel project id: `prj_eBSOTwuA1tBhcpYCVhQFdSc02bE8`
   Dependency on AgentCache: CDN, transcode, brain/memory routes

2. Repo: `../jettythunder-v2`
   Domain/Product: `jettythunder.app`
   Vercel project: `file-management-platform`
   Vercel project id: `prj_yewt0QALR4qt8qXtN93vPbosOSci`
   Dependency on AgentCache: provisioning, jetty routes, upload/cache flows, storage-adjacent services

3. Repo: `../hip-networks`
   Domain/Product: `hip-networks`
   Vercel project: `hip-networks`
   Vercel project id: `prj_DjcGaU93QzYUgLOXJMpDXSLyXfoH`
   Dependency on AgentCache: constellation-level alignment and likely shared infra/domain ties

4. Repo: `../maxxeval`
   Domain/Product: `maxxeval.com`
   Vercel project: `maxxeval`
   Vercel project id: `prj_Edl8oMBJDEd3il24dwdkYvaabm6w`
   Dependency on AgentCache: needs-signals ingestion and market-demand feedback

### Related Project Mentioned In This Repo But Not Confirmed As Local Repo

- Product: `clawsave.com`
- Evidence: route mapping in `src/middleware/customerUsageTracking.ts`
- Local repo/project name: not confirmed from this workspace

### Shared Infra Assumptions Confirmed By Repo Context

- Vercel deployment
- Neon PostgreSQL
- Upstash Redis
- Seagate Lyve / S3-compatible storage
- Hono primary backend in `src/index.ts`
- MCP server in `src/mcp/server.ts`

## Current Directional Assessment

This is not the final scored audit, but the codebase currently appears strongest in:

- API surface area
- semantic cache and memory infrastructure
- provisioning and onboarding paths
- receipts and evidence instrumentation
- customer-specific endpoint routing
- MCP and agent discovery surface

It appears weakest in:

- hardened autonomous payments
- real agent-to-agent commerce settlement
- strict marketplace fulfillment semantics
- deploy-truth documentation consistency
- unified cross-repo operational governance

## Workstream 1: System Map And Ownership (10)

1. Every production repo in the constellation is enumerated with canonical local path, Git remote, domain, and owner.
2. Every repo is mapped to a Vercel project name and Vercel project id.
3. Every repo has a clearly documented dependency direction relative to AgentCache.
4. Shared infrastructure dependencies are explicitly documented by environment.
5. Customer-critical routes are mapped to owning repo and runtime.
6. A single source of truth exists for repo-to-domain-to-project relationships.
7. Preview, staging, and production environments are distinguished for each project.
8. Domain aliases and customer-facing hostnames are documented and current.
9. Service ownership is assigned by subsystem, not just by repo.
10. The control-plane versus workload-plane boundary is explicitly defined.

## Workstream 2: Product Surface Definition (10)

1. AgentCache Core has a stable service definition that matches shipped APIs.
2. AgentCache Guardrails has a stable service definition that matches shipped APIs.
3. AgentCache Knowledge has a stable service definition that matches shipped APIs.
4. The public docs match the currently routed API surface.
5. Each product surface has a clear target user: human team, internal service, or autonomous agent.
6. Each surface has at least one authenticated usage path.
7. Each surface has at least one customer or design-partner workload attached.
8. Deprecated product surfaces are marked and not presented as active.
9. Pricing language maps to real quota or billing mechanics.
10. The service catalog distinguishes real capabilities from roadmap items.

## Workstream 3: Agent Discovery And Identity (10)

1. `/.well-known/agents.json` is live and accurate.
2. `skill.md` accurately describes onboarding and usage for agents.
3. MCP manifest discovery is available and consistent with actual tools.
4. Agent registration produces durable agent identity and credentials.
5. Agent identity is distinct from human user identity.
6. Agent identity can be resolved from API key or registry lookup.
7. Agent metadata includes role, capabilities, and guardrails.
8. Agent-facing discovery headers are returned on relevant API responses.
9. External agents can be represented without forcing full internal registration.
10. Agent identity resolution works across previews, production, and internal services.

## Workstream 4: Provisioning And Onboarding (10)

1. Self-serve provisioning creates API keys successfully.
2. Provisioning creates namespaces or equivalent tenant isolation primitives.
3. Provisioning records installation metadata durably.
4. Onboarding for `jettythunder.app` is wired and tested.
5. Community/free provisioning is distinct from enterprise provisioning.
6. Provisioning responses include enough information for autonomous setup.
7. Provisioned credentials are stored hashed or with equivalent safety guarantees.
8. Provisioning can be replayed idempotently without corrupting tenant state.
9. Workspace/org onboarding is documented by environment.
10. Failed provisioning paths return actionable errors instead of silent partial success.

## Workstream 5: Authentication And Principal Resolution (10)

1. API-key auth is enforced on protected routes.
2. Principal resolution distinguishes user, org, and agent identities.
3. Tier resolution is consistent across cached and uncached auth paths.
4. Usage tracking is attached to authenticated requests.
5. Auth fails closed on DB/cache failures.
6. Admin auth is segregated from standard API auth.
7. Token issuance and JWT auth for human portals are clearly separated from API-key auth.
8. Auth logic is consistent between Hono routes and any remaining legacy handlers.
9. Protected routes do not rely on frontend-only assumptions.
10. Auth errors expose remediation without leaking sensitive state.

## Workstream 6: Semantic Cache Infrastructure (10)

1. Cache check/get/set flows are implemented and routable.
2. Cache keys are deterministic and stable.
3. Cache writes honor tier and TTL policy resolution.
4. Cache reads and writes emit analytics.
5. Cache reads and writes emit billing events.
6. Namespace or tenant boundaries are enforced in cache behavior.
7. Sector-aware or policy-aware cache isolation is implemented.
8. Miss paths and hit paths are contract-tested.
9. Anti-cache or invalidation paths exist for mutable workloads.
10. Cache APIs are usable directly by agents, not only by human dashboards.

## Workstream 7: Memory And Knowledge Fabric (10)

1. Memory store is implemented with authenticated write access.
2. Memory recall is implemented with authenticated read access.
3. Vector or semantic search backend is wired for production use.
4. Memory writes are constrained for size and abuse resistance.
5. Predictive or cognitive recall signals are exposed where intended.
6. Knowledge ingest and retrieval are tied to a durable backend.
7. Memory APIs are multi-tenant safe.
8. Memory APIs are documented for autonomous use.
9. Memory health checks distinguish configured versus mock backends.
10. Knowledge surfaces are not mislabeled as production if they remain mock-only.

## Workstream 8: Guardrails, Armor, And Policy (10)

1. WAF or request armor runs before protected APIs.
2. Policy enforcement exists for high-risk message or tool paths.
3. PII/secret redaction exists in a reusable layer.
4. Tool scanning exists for JS/TS and Python sources.
5. Guardrail results affect system behavior, not just logs.
6. Policy decisions are observable or receiptable where needed.
7. Tenant-specific or workload-specific policy extensions are supported.
8. Prompt or content validation can block unsafe execution.
9. Guardrails are wired into customer-critical paths where risk justifies it.
10. Policy docs match actual enforcement behavior.

## Workstream 9: Receipts, Auditability, And Trust Evidence (10)

1. Shared receipt schema is versioned and validated.
2. Receipt ingestion detects duplicates and content conflicts.
3. Receipt signatures can be verified when secrets are configured.
4. Receipt summary surfaces expose meaningful operational aggregates.
5. Browser-proof receipts are represented explicitly.
6. Soulprint or trust receipts are represented explicitly.
7. Receipt APIs are authenticated where appropriate.
8. Receipt analytics feed dashboards or operational views.
9. Evidence export paths exist for downstream trust workflows.
10. Contract tests cover at least the main receipt families in production use.

## Workstream 10: External Agent Registration And Soulprint (10)

1. External agent registration exists as an authenticated API.
2. Ownership verification exists for external agents.
3. Soulprint scanning can attach to an external registration.
4. Soulprint reports are retrievable after scan completion.
5. External-agent summary views aggregate by system, sector, and bias flags.
6. Registration ownership is enforced on reads and writes.
7. Soulprint scan emits a trust receipt.
8. Registration works under mock DB and contract-test conditions.
9. The external-agent model supports both generic and named ecosystems.
10. This surface is clearly positioned as a trust/onboarding layer, not yet a full marketplace substitute.

## Workstream 11: Billing, Credits, And Human Checkout (10)

1. Stripe checkout exists for plans or add-ons.
2. Stripe checkout exists for credits or top-offs.
3. Billing portal flow exists for self-serve account management.
4. Billing webhooks update durable subscription or purchase state.
5. Billing can run in demo mode without corrupting real state.
6. Usage quotas are enforced against tier.
7. Overage via credits is enforced when quota is exceeded.
8. Billing dashboards expose credits or usage meaningfully.
9. Human-buyer flows are distinguishable from agent-autonomous flows.
10. Price surfaces in code and UI are synchronized enough to avoid operator confusion.

## Workstream 12: Agent Payments And Autonomous Settlement (10)

1. The platform supports an explicit machine-payable auth path.
2. Preauthorization settlement is validated beyond simple string shape checks.
3. On-chain verification performs real transaction validation in production.
4. Settlement is idempotent.
5. Settlement has circuit-breaker or velocity protections.
6. Settlement credits a durable ledger or treasury path.
7. Settlement failure modes are explicit and actionable.
8. Mission budgets or quotas exist for autonomous actors.
9. Revenue distribution logic exists and is bounded by contracts or policy.
10. Autonomous payment docs match actual runtime behavior.

## Workstream 13: Marketplace And Agent Commerce (10)

1. Agents can list services or capabilities for sale.
2. Agents can browse available listings.
3. Agents can purchase listings.
4. Purchases create durable order records.
5. Purchases trigger fulfillment or access-grant logic deterministically.
6. Commerce settlement uses a trustworthy payment substrate.
7. Listing validation prevents obviously malformed or unsafe offerings.
8. Listing-to-capability mapping is explicit, not heuristic-only.
9. Marketplace inventory is clearly separated between real and experimental items.
10. Marketplace outcomes are auditable with receipts, orders, and entitlement state.

## Workstream 14: MCP And Agent Tooling Surface (10)

1. MCP server starts successfully with the documented command.
2. MCP manifest accurately describes currently exposed tools.
3. Core cache and memory tools are present in MCP.
4. Security controls exist for MCP rate limiting and audit logging.
5. MCP tools can authenticate against real AgentCache APIs.
6. MCP docs distinguish local stdio usage from hosted discovery.
7. Tool outputs are machine-usable and stable.
8. Admin-only MCP capabilities are clearly segregated.
9. MCP can be used by third-party agent frameworks, not just internal demos.
10. MCP is treated as a first-class product surface, not an orphan sidecar.

## Workstream 15: Customer-Critical Endpoints (10)

1. `audio1.tv` CDN routes are clearly identified and routed.
2. `audio1.tv` transcode routes are clearly identified and routed.
3. `audio1.tv` brain/memory routes are clearly identified and routed.
4. `jettythunder.app` provisioning route is clearly identified and routed.
5. `jettythunder.app` upload/cache routes are clearly identified and routed.
6. `clawsave.com` routes are clearly identified and routed.
7. Customer usage tracking maps these routes to correct customer ids.
8. Contract or integration tests exist for critical customer routes.
9. Preview deployment verification is part of the change discipline for these paths.
10. No architectural cleanup is allowed to silently break these routes.

## Workstream 16: Background Jobs, Cron, And Automation (10)

1. Inngest functions are present and routed intentionally.
2. Vercel cron entries match real handlers.
3. Growth/research/needs-signal background loops are documented.
4. Cron handlers have auth or secret validation where required.
5. Long-running jobs are separated from request/response critical paths.
6. Failure handling for background jobs is observable.
7. Job outputs persist into useful product state.
8. Background jobs do not rely on undeclared local-only conditions.
9. Job cadence is documented by business purpose.
10. Background tasks can be paused or debugged without guesswork.

## Workstream 17: Observability And Operational Truth (10)

1. Stats endpoints expose meaningful system state.
2. Observability includes customer or service usage metrics.
3. Receipts feed operational dashboards.
4. Error paths are logged consistently.
5. Billing/usage/receipt summaries can be correlated.
6. Latency and failure signals are present for key workflows.
7. Recent request or event trails exist for debugging.
8. Global stats distinguish mock versus real infrastructure when needed.
9. Dashboard panels rely on real API data instead of static placeholders where claimed.
10. Production-truth and demo-truth are clearly separated.

## Workstream 18: Multi-Tenancy And Isolation (10)

1. Tenant isolation is enforced in cache and memory paths.
2. Org-scoped versus key-scoped behavior is intentional and documented.
3. Cross-customer contamination is prevented in billing and analytics.
4. Namespace creation is tied to real tenant boundaries.
5. Per-tenant feature gates are available.
6. API keys can be deactivated without leaving orphaned broad access.
7. Principal resolution feeds access control consistently.
8. Sensitive customer flows do not rely on shared demo credentials.
9. Tenant isolation assumptions are tested at least at contract level.
10. Shared infra usage does not imply shared data visibility.

## Workstream 19: Deployment Topology And Environment Discipline (10)

1. Every core repo has a confirmed Vercel project mapping.
2. Preview and production environment variables are documented.
3. The app source of truth for deployed API routing is explicit.
4. Legacy runtime paths are documented and bounded.
5. Build outputs and public assets are intentionally managed.
6. Local mock behavior is clearly distinguished from deployed behavior.
7. Deployment docs do not contradict the current Hono/Vercel architecture.
8. Environment secrets for billing, storage, DB, and auth are enumerated.
9. Runtime region and function limits are documented where material.
10. Cross-repo deploy dependencies are understood before customer-facing changes ship.

## Workstream 20: GTM, Packaging, And Agentic Business Readiness (10)

1. The platform has a coherent statement of the service agents are meant to buy.
2. The primary buyer is defined: human team, autonomous agent, or hybrid.
3. The value metric is tied to real usage or compute economics.
4. Pricing maps to actual product controls.
5. The service catalog distinguishes infrastructure services from consulting-like offerings.
6. Customer case-study claims can be supported by code or deployment evidence.
7. Marketplace claims do not outpace actual settlement and entitlement mechanics.
8. Agentic payment claims do not outpace actual on-chain verification.
9. The design-partner path to paid production usage is defined.
10. The public positioning can survive a skeptical technical due-diligence review.

## Recommended Audit Sequence

Do not score the 200 points in random order.

Use this sequence:

1. System map and deployment truth
2. Customer-critical endpoint validation
3. Auth, principal resolution, and tenancy
4. Cache, memory, and guardrails
5. Receipts and observability
6. Billing and human checkout
7. Agent payments and autonomous settlement
8. Marketplace and fulfillment
9. MCP and external agent ecosystem
10. GTM packaging and claims review

## Suggested Next Deliverables

After this blueprint, create three companion artifacts:

1. `Constellation Map`
   Purpose: repos, domains, Vercel projects, shared infra, env boundaries, owners

2. `Readiness Scorecard`
   Purpose: score all 200 points with evidence and owner

3. `Gap Closure Plan`
   Purpose: top 25 fixes ordered by revenue risk, customer risk, and agent-commerce impact

## Recommended Initial Thesis

Based on the current codebase, the likely thesis to test is:

- AgentCache is already a credible agent infrastructure service.
- AgentCache is partially wired for agentic onboarding, discovery, receipts, and metering.
- AgentCache is not yet fully hardened for autonomous payments and agent-to-agent commerce.
- The shortest path to agentic credibility is to finish trust, metering, provisioning, and evidence flows before over-claiming autonomous marketplace economics.

That thesis should be proved or disproved by scoring this document.
