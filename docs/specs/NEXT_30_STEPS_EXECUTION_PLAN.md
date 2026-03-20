# Next 30 Steps Execution Plan

Status: Historical first-run graph  
Date: 2026-03-14

Superseded by [NEXT_30_STEPS_EXECUTION_PLAN_V2.md](/Users/letstaco/Documents/agentcache-ai/docs/specs/NEXT_30_STEPS_EXECUTION_PLAN_V2.md) for the current 31-60 scale-out cycle.

## Purpose

This is the current operating sequence for the next 30 concrete steps across:

- `AgentCache.ai`
- `MaxxEval`
- `JettyThunder`

The goal is not to do everything at once. The goal is to keep one coherent execution graph across
storage mesh, trust receipts, pricing, and design-partner readiness.

## Operating Rule

We will use one execution graph and one orchestration surface.

- The plan lives in [buildoutPlan.ts](/Users/letstaco/Documents/agentcache-ai/src/lib/workflow/buildoutPlan.ts)
- The CLI entrypoint is [orchestrate-buildout.ts](/Users/letstaco/Documents/agentcache-ai/scripts/orchestrate-buildout.ts)
- Dispatch goes through the existing workflow lane system in [LaneService.ts](/Users/letstaco/Documents/agentcache-ai/src/lib/workflow/LaneService.ts)

Default behavior is dry-run. We only dispatch explicit step ids.

## The 30 Steps

### Phase 1: Foundation

1. `S01` Lock shared receipt schema as the cross-repo contract
2. `S02` Emit storage transfer receipts from JettyThunder flows
3. `S03` Ingest JettyThunder storage receipts into AgentCache
4. `S04` Add MaxxEval receipt relay helper
5. `S05` Create receipt inspection dashboard surface
6. `S06` Normalize principal identity across API keys, profiles, and wallets

### Phase 2: Storage Mesh

7. `S07` Add Lyve object-scope verification script
8. `S08` Add endpoint-region mismatch health gate
9. `S09` Define chunk warming and cache miss policy
10. `S10` Instrument transfer ROI metrics
11. `S11` Add edge health scorecards for JettySpeed routes
12. `S12` Create storage evidence bundle export

### Phase 3: Trust Products

13. `S13` Ship honest uncertainty receipts
14. `S14` Extend Pathological API with storage and retrieval probes
15. `S15` Add provider trust scorecards to MaxxEval
16. `S16` Create evidence-backed billing modifiers
17. `S17` Expose storage mesh posture in AgentCache catalog

### Phase 4: Design Partner Readiness

18. `S18` Prepare enterprise copilot pilot package
19. `S19` Prepare finance memory fabric pilot package
20. `S20` Create design partner onboarding automation
21. `S21` Add managed workload namespaces and tenant policy templates
22. `S22` Publish evidence-first ROI dashboard

### Phase 5: Orchestration

23. `S23` Create managed buildout orchestrator
24. `S24` Add phase-level gating and dependencies to orchestrator
25. `S25` Add transcript and receipt hooks to orchestrator runs
26. `S26` Map each build lane to a specialist sub-agent profile

### Phase 6: Revenue Hardening

27. `S27` Tie receipts to SKU-specific billing in MaxxEval
28. `S28` Add buyer-facing trust filters and proof selectors
29. `S29` Run first internal cross-repo proving loop
30. `S30` Choose and onboard first three design partners

## Lane Model

- `architecture`
  - contracts, identity, dependency rules, sub-agent roles
- `software-quality`
  - gates, deterministic validation, hardening, health checks
- `storage-mesh`
  - Lyve, JettyThunder, JettySpeed, transfer proofs
- `trust-evidence`
  - receipts, exports, scorecards, proof surfaces
- `market-systems`
  - buyer filters, ranking, trust-visible commerce
- `revenue-ops`
  - billing, ROI, pricing, package instrumentation
- `design-partners`
  - pilot packages, onboarding, proving loops

## Orchestrator Usage

Dry-run all steps:

```bash
npm run orchestrate:buildout
```

Filter by lane:

```bash
npm run orchestrate:buildout -- --lane storage-mesh
```

Dispatch explicit work items:

```bash
npm run orchestrate:buildout -- --dispatch --steps S02,S03,S07
```

Emit JSON for tooling:

```bash
npm run orchestrate:buildout -- --format json
```

## Recommended Immediate Order

The next practical sequence is:

1. `S02` JettyThunder storage transfer receipts
2. `S03` AgentCache storage receipt ingestion and rollups
3. `S04` MaxxEval receipt relay helper
4. `S07` object-scope Lyve verification script
5. `S08` config mismatch health gate
6. `S10` transfer ROI metrics

That sequence keeps us close to the product we are already building:

- storage mesh
- evidence
- trust
- measurable ROI

## Success Condition

At the end of this 30-step run, we should have:

- one receipt contract across repos
- one real storage evidence path
- one coherent trust and pricing layer
- one orchestrated execution model for sub-agents
- one design-partner-ready product story
