# Next 30 Steps Execution Plan V2

Status: Active  
Date: 2026-03-15

## What Changed

We did **not** finish the original 30-step run.

What is actually complete from the first execution graph:

- `S01` shared receipt schema locked
- `S02` JettyThunder storage transfer receipts emitted
- `S03` AgentCache storage receipt ingestion and rollups
- `S04` MaxxEval shared receipt relay helper and route integrations
- `S07` Lyve object-scope verification script
- `S08` endpoint-region mismatch health gate
- `S23` managed buildout orchestrator
- `S24` dependency-aware orchestration gate

That means the first run is materially underway, but not closed.

## Operating Decision

We will continue in two layers:

1. Keep the unfinished first 30-step graph alive.
2. Start the next 30 as the `scale-out graph`, because several of those items depend on the receipt spine we already built.

The canonical machine-readable graph remains:

- [buildoutPlan.ts](/Users/letstaco/Documents/agentcache-ai/src/lib/workflow/buildoutPlan.ts)
- [orchestrate-buildout.ts](/Users/letstaco/Documents/agentcache-ai/scripts/orchestrate-buildout.ts)

## Next 30 Themes

The second 30-step run is about six things:

- external agent identity and preregistration
- Soulprint as a real trust product
- Panda/browser substrate hardening
- commerce and proof surfaces
- orchestrator specialization and receipts
- design-partner and revenue grounding

## Steps 31-60

### Phase 7: External Agent Identity

31. `S31` External agent registration model and API  
32. `S32` Moltbook bot preregistration flow  
33. `S33` Soulprint receipt subject and schema support  
34. `S34` Soulprint static parser  
35. `S35` Soulprint and preregistration report surfaces

### Phase 8: Browser Substrate

36. `S36` Panda adapter behind BrowserProofService  
37. `S37` Browser witness contract tests  
38. `S38` Authenticated browser workflow receipts  
39. `S39` Browser proof confidence in MaxxEval trust views  
40. `S40` Browser ROI and failure rollups

### Phase 9: Commerce Trust Surfaces

41. `S41` Receipt inspection dashboard  
42. `S42` Buyer-facing proof selectors and commerce receipt filters  
43. `S43` Storage and commerce evidence bundle export  
44. `S44` Composite provider trust scorecards  
45. `S45` Metabolic pricing prototype

### Phase 10: Orchestrator Agents

46. `S46` Completed-state tracking in orchestrator graph  
47. `S47` Specialist sub-agent manifest by lane  
48. `S48` Orchestrator transcript and receipt hooks  
49. `S49` Dependency-aware dispatch guardrails  
50. `S50` Sub-agent work packet generation

### Phase 11: Design Partner Operations

51. `S51` Design partner onboarding automation  
52. `S52` Managed workload namespaces and tenant policy templates  
53. `S53` Evidence-first ROI dashboard  
54. `S54` Internal cross-repo proving loop  
55. `S55` Case study export

### Phase 12: Revenue and Market Grounding

56. `S56` SKU-specific billing backed by receipts  
57. `S57` Score first three design partner targets  
58. `S58` Founder-facing partner pipeline tracker  
59. `S59` Package Soulprint and Grief Engine as attachable trust products  
60. `S60` Launch-readiness review for the next public cycle

## Orchestrator Rule

The orchestrator is no longer just a dry-run checklist printer.

It should become:

- a dependency-aware dispatcher
- a specialist sub-agent router
- a transcript generator
- a receipt-producing execution surface

Current useful commands:

```bash
npm run orchestrate:buildout -- --summary
npm run orchestrate:buildout -- --status completed
npm run orchestrate:buildout -- --phase "Phase 10: Orchestrator Agents"
npm run orchestrate:buildout -- --dispatch --steps S31,S33
```

## Recommended Immediate Order

The best next practical sequence is:

1. `S31` external agent registration model
2. `S33` Soulprint receipt subject support
3. `S34` Soulprint parser
4. `S36` Panda adapter
5. `S41` receipt inspection dashboard
6. `S46` completed-state orchestration and progress reporting

That sequence keeps us aligned with the strongest near-term product direction:

- preregister outside agents
- audit them before runtime
- prove browser-backed evidence more credibly
- expose the evidence spine to operators
- let the orchestrator manage the next cycle with better state

## Success Condition

At the end of the next 30-step run, we should have:

- external agents registerable before runtime
- Soulprint as a real pre-deployment trust product
- Panda in the browser proof execution path
- operator-facing receipt inspection
- orchestrator runs with specialist agent profiles and transcript hooks
- a design-partner motion supported by real billing, ROI, and proof exports
