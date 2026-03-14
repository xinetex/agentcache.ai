# Production Remediation And Phase Plan

## Purpose

This document turns the current local-delta audit into an execution plan.

The immediate goal is to convert the remaining uncommitted work in `agentcache-ai` into production-grade, reviewable slices. The follow-on goal is to use those slices to move the platform toward a disciplined production roadmap instead of accumulating loosely related local changes.

## Current State

### Already pushed

- Branch: `codex/agentic-caching-platform`
- Latest pushed work includes:
  - memory-fabric policy
  - ROI analytics
  - accounting dashboard
  - repository/data contract docs

### Still only local

The remaining local delta is a separate body of work. It spans:

- runtime hardening
- trust and reputation changes
- Collective Cortex session work
- marketplace and schema realignment
- local verification and debug scripts

This plan assumes that delta should be split into coherent commits and only merged when each slice passes its own gates.

## Non-Negotiable Rules

1. No secret-derived identities.
   Example: badges or trust artifacts must never use raw API keys as the agent identifier.

2. No destructive schema rewrites presented as "safe" migration.
   Marketplace and ledger alignment must be additive or fully staged with rollback.

3. No hidden compile health.
   Excluding scripts or verification files from `tsconfig` is acceptable only if they are explicitly de-scoped.

4. No mixed commits.
   Runtime hardening, governance logic, marketplace changes, and experimental features must not ship in one bundle.

5. No new feature slice without a validation story.
   Every phase needs tests, targeted verification, and explicit exit criteria.

## Workstreams

### Workstream A: Runtime Hardening

Scope:

- `src/db/client.js`
- `src/lib/redis.ts`
- `src/services/LedgerService.ts`
- `src/services/DreamService.ts`
- `src/infrastructure/CognitiveEngine.ts`
- `src/infrastructure/PatternEngine.ts`
- `src/services/SemanticBusService.ts`
- `src/services/MoltAlphaService.ts`
- `src/services/MoltBadgeService.ts`
- `src/services/PeriscopeService.ts`
- `src/sectors/FinanceEngine.ts`
- `src/sectors/HealthcareEngine.ts`

Intent:

- make lazy initialization deterministic
- make mock DB and mock Redis usable in tests and offline environments
- remove test-only failures caused by missing runtime helpers
- keep maintained code paths working when external services are unavailable

Key risks to fix inside this workstream:

- mock `db.execute()` is currently a no-op
- some services still rely on raw SQL or implicit DB behavior
- runtime and mock behavior can drift apart

Deliverables:

- mock DB behavior for the maintained SQL/update paths is either implemented or removed from hot paths
- Redis mock covers the subscription and rate-limiting methods used by the app
- Dream, Pattern, and Molt flows run cleanly against the hardened mocks

Validation:

- `npx tsc --noEmit --pretty false`
- `npm test -- --run`
- targeted tests for Dream, Pattern, Periscope, and x402 flows

Exit criteria:

- no maintained path depends on a silent mock no-op
- offline/test startup is deterministic
- full suite stays green

Commit recommendation:

- `runtime: harden mock db and redis paths`

### Workstream B: Trust And Governance Correction

Scope:

- `src/api/molt.ts`
- `src/services/ReputationService.ts`
- `src/services/MoltBadgeService.ts`
- `src/services/InterventionGate.ts`
- `tsconfig.json`
- verification scripts touching reputation

Intent:

- restore correct trust identity semantics
- avoid overstating system health
- keep collective governance logic meaningful

Known issues:

- `src/api/molt.ts` currently binds badge identity to `apiKey`
- `src/services/ReputationService.ts` currently hardcodes sector health to healthy
- `tsconfig.json` currently excludes active verification surfaces without a clear support statement

Required fixes:

1. Badge identity must resolve to principal or agent ID, not credential string.
2. Sector reputation must be computed or clearly deactivated, not faked.
3. Verification scripts must either be updated for the async reputation API or formally moved out of supported surface.
4. `tsconfig` exclusions must be justified, narrowed, or reverted.

Validation:

- typecheck
- trust and reputation targeted tests
- manual route verification for `/api/molt/issue-badge`
- intervention-gate behavior check with degrading and critical sector states

Exit criteria:

- no secret-derived identity
- sector risk can still influence intervention logic
- compile health reflects supported code honestly

Commit recommendation:

- `trust: restore principal-based badges and sector health`

### Workstream C: Collective Cortex

Scope:

- `src/services/CollectiveCortex.ts`
- `src/infrastructure/CognitiveEngine.ts`
- `src/api/observability.ts`
- `src/components/dashboard/CognitiveMap.tsx`
- `scripts/verify_collective_state.ts`

Intent:

- introduce shared multi-agent session state as a real feature slice
- make session discovery safe enough for UI consumption

Known issues:

- `/api/observability/sessions` reads every `session:*` key as JSON
- Redis already stores non-session-history keys under the same prefix family
- the UI assumes the route is trustworthy and lightweight

Required fixes:

1. Move joint sessions to a dedicated namespace, for example `joint_session:*`.
2. Add a dedicated repository or index key for active sessions instead of broad `keys('session:*')`.
3. Keep UI rendering defensive around incomplete participant/session data.
4. Add targeted tests for the session route and the convergence flow.

Validation:

- targeted tests for Collective Cortex service and observability route
- dashboard smoke test
- verification script updated to the final namespace

Exit criteria:

- session route cannot 500 on mixed Redis keys
- session UI renders only valid session objects
- directives and convergence path are testable

Commit recommendation:

- `collective-cortex: add joint session control plane`

### Workstream D: Marketplace And Hub-Agent Alignment

Scope:

- `src/db/schema.js`
- `src/services/MarketplaceService.ts`
- `scripts/verify_marketplace.ts`
- `scripts/safe_migrate.ts`
- any related DB scripts

Intent:

- align marketplace ownership and orders with `hub_agents`
- make access grants and settlement flows coherent
- replace destructive schema handling with a production-safe migration path

Known issues:

- `scripts/safe_migrate.ts` drops live tables
- marketplace capability mapping is still heuristic
- mock DB support for marketplace vote/update paths is incomplete

Required fixes:

1. Replace the destructive SQL script with additive migration steps.
2. Define the exact schema transition from UUID agent refs to `hub_agents.id`.
3. Introduce explicit tool/product mapping instead of title-derived access grants.
4. Update marketplace verification so it proves balances, order creation, and access grants without requiring destructive setup.

Validation:

- schema validation and migration dry run
- marketplace verification script
- targeted tests for listing creation, purchase, access grant, and voting

Exit criteria:

- no table-dropping migration in the supported path
- marketplace flow works with hub-agent IDs
- tool access grant is deterministic and reviewable

Commit recommendation:

- `marketplace: align commerce with hub agents`

### Workstream E: Experimental And Debug Assets

Scope:

- `list_tables.ts`
- `moltest_spillover.ts`
- `test_moonshot.ts`
- `.vscode/settings.json`

Intent:

- keep debugging assets available without polluting supported production surface

Plan:

- move reusable scripts under `scripts/debug/`
- leave editor settings uncommitted unless explicitly team-approved
- keep one-line scripts only if they have a clear recurring use

Exit criteria:

- no scratch files at repo root unless they are promoted into a maintained tool

Commit recommendation:

- `chore: organize local debug utilities`

### Workstream F: MemoryBank Introduction

Scope:

- `src/services/MemoryBank.ts`
- any call sites or tests that would introduce it

Intent:

- keep this as a deliberate feature slice, not a hidden extra

Plan:

1. Decide the first integration trigger.
   Examples:
   - after browser proof completion
   - after ontology excavation
   - after successful agent job delivery
2. Add tests for conflict resolution and reinforcement behavior.
3. Introduce it only after the runtime hardening slice is merged.

Exit criteria:

- clear trigger path
- clear source-of-truth tables
- dedicated tests

Commit recommendation:

- `memorybank: add knowledge consolidation service`

## Phase Sequence

### Phase 0: Stabilize The Worktree

Goal:

- separate production slices from mixed local edits

Tasks:

- tag every remaining file as keep, fix, drop, or local-only
- move scratch files out of the root or discard them
- define commit boundaries before more coding

Output:

- this plan
- a cleaned slice order

### Phase 1: Runtime Hardening

Primary workstream:

- Workstream A

Reason:

- every later phase depends on stable mocks, deterministic startup, and honest test behavior

### Phase 2: Trust And Governance Repair

Primary workstream:

- Workstream B

Reason:

- identity correctness and sector risk are foundational trust claims

### Phase 3: Collective Multi-Agent State

Primary workstream:

- Workstream C

Reason:

- this is a differentiated capability, but only after safe session indexing exists

### Phase 4: Marketplace Realignment

Primary workstream:

- Workstream D

Reason:

- commerce should not be built on destructive migrations or heuristic access grants

### Phase 5: Productization Cleanup

Primary workstreams:

- Workstream E
- Workstream F

Reason:

- once runtime, trust, collective state, and commerce are stable, the repo can absorb experimental services and debug tools cleanly

### Phase 6: Production Gates

Goal:

- make the repo fit for broader deployment and cross-repo integration with MaxxEval

Tasks:

- define supported surfaces versus lab surfaces
- add launch checklist for runtime envs
- add failure-mode tests for Redis mock, DB mock, and external service absence
- confirm receipts, trust, and marketplace surfaces stay aligned

Exit criteria:

- supported code surface compiles and tests cleanly
- destructive scripts are clearly isolated or removed
- trust and commerce claims match runtime behavior

## Validation Matrix

### Required on every phase

- targeted typecheck
- targeted tests for touched subsystem
- full repo test run before commit

### Required before merge to production branch

- `npx tsc --noEmit --pretty false`
- `npm test -- --run`
- manual smoke for:
  - cache routes
  - observability stats
  - badge issuance
  - marketplace flow if touched

## Commit Order

Recommended order:

1. `runtime: harden mock db and redis paths`
2. `trust: restore principal-based badges and sector health`
3. `collective-cortex: add joint session control plane`
4. `marketplace: align commerce with hub agents`
5. `chore: organize local debug utilities`
6. `memorybank: add knowledge consolidation service`

## What Not To Do

- do not merge all remaining local changes at once
- do not ship `safe_migrate.ts` in its current form
- do not keep badge identity tied to credentials
- do not leave `getSectorReputation()` as a constant healthy stub
- do not let `tsconfig` exclusions become a substitute for fixing supported code

## Recommended Immediate Next Action

Start with Phase 1.

The highest-leverage next move is to fix the runtime-hardening slice around `src/db/client.js` and `src/lib/redis.ts`, then revalidate Dream, Periscope, x402, and marketplace-adjacent flows against the hardened mocks. That reduces the chance that later feature work is validated against unrealistic local behavior.
