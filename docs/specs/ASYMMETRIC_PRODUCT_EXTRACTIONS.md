# Asymmetric Product Extractions

Status: Active  
Date: 2026-03-14  
Owner: AgentCache.ai

## Purpose

This document extracts the most feasible, high-leverage product ideas from
`/Users/letstaco/Documents/IDEAS/asymmetric-ideation-output.md` and converts them
into concrete build tracks that fit the current company strategy.

These ideas are only worth pursuing if they strengthen the current operating thesis:

- AgentCache = memory, cache, evidence, hardening
- MaxxEval = trust, pricing, escrow, evaluation
- shared receipts = common substrate across systems

## Selection Rule

The ideas selected here passed three tests:

1. they fit the current wedge instead of distracting from it
2. they can be implemented using systems we already have or are already building
3. they strengthen near-term revenue or trust differentiation

## Selected Tracks

### Track 1: Pathological API

Working name:

`AgentCache Pathological API`

Core idea:

Sell adversarial, edge-case, contradiction-rich inputs as a paid hardening layer
for production agents.

### Why this fits now

- It extends the existing trust and browser-proof direction.
- It gives us a strong enterprise painkiller: pre-production hardening.
- It can produce measurable evidence and certifications.
- It does not require a separate market structure to be useful.

### What the customer buys

- adversarial endpoint bundles
- difficulty-tiered test suites
- robustness reports
- signed hardening receipts
- provider or agent “resistance” scoring

### Initial SKUs

- `pathological-basic`
- `pathological-finance`
- `pathological-browser`
- `pathological-certification`

### Primary buyers

- AI platform teams
- agent builders
- operators deploying autonomous workflows
- security and red-team adjacent teams

### Product surface

#### AgentCache

- adversarial endpoint library
- scenario orchestration
- browser-proof capture where useful
- signed receipts for every pathological run

#### MaxxEval

- resistance scoring
- certification display
- paid export of robustness reports

### Shared receipt additions

Suggested fields in `payload` and `telemetry`:

- `pathologyTier`
- `failureMode`
- `recoveryMode`
- `degraded`
- `judgeScore`
- `survived`

### 30-day implementation sequence

1. add `PATHOLOGICAL_API` scenarios as structured fixtures
2. add paid execution path and receipts
3. score results and expose summary in AgentCache
4. export a certification summary through MaxxEval

### Acceptance metrics

- number of pathological runs
- survival rate
- mean recovery score
- certification conversion rate

## Track 2: Confession Toll

Working name:

`Honest Uncertainty Receipts`

Core idea:

Do not implement the full “Epistemic Commons” first.
Implement the practical version:

agents that explicitly admit uncertainty and request proof, retrieval, or external
resolution emit a specialized receipt and earn higher trust than agents that bluff.

### Why this fits now

- It maps cleanly onto trust receipts.
- It supports the “prove your agents work” message.
- It improves trust scoring and evaluation immediately.
- It gives us a differentiated policy primitive without requiring a token economy.

### What the customer buys

- uncertainty-aware routing
- uncertainty receipts
- trust signals based on epistemic honesty
- optional paid retrieval/proof flow when uncertainty is declared

### Product surface

#### AgentCache

- uncertainty declaration path
- optional retrieval/proof execution
- receipt creation

#### MaxxEval

- honesty-weighted trust profile
- uncertainty reporting
- lower-risk ranking for honest agents

### Shared receipt additions

Suggested fields:

- `epistemicState`
- `knowledgeGapType`
- `confessedUnknown`
- `resolutionMode`
- `resolutionCostMicros`
- `hallucinationAvoided`

### Phase 1 implementation

1. define a receipt subtype for uncertainty declarations
2. add a simple API surface where a producer can declare:
   - “I do not know”
   - “I need retrieval”
   - “I need browser proof”
3. persist and score those receipts
4. feed them into trust and profile exports

### Acceptance metrics

- number of uncertainty receipts
- % resolved via retrieval or proof
- trust delta between honest and non-honest paths
- reduced hallucination/dispute incidence

## Track 3: Morphic Escrow

Working name:

`Identity-Consistency Escrow`

Core idea:

Do not build a fully on-chain morphic escrow protocol first.
Build a practical escrow layer where high-value agent workflows are scored on
identity and policy consistency throughout execution, and escrow release depends
on maintaining coherence.

### Why this fits now

- It uses the existing trust and escrow direction in MaxxEval.
- It turns identity consistency into an economic primitive.
- It is easier to sell than abstract “agent soul” language.

### What the customer buys

- safer multi-step agent transactions
- consistency-backed escrow release
- evidence that the agent stayed within policy and role

### Product surface

#### MaxxEval

- escrow workflow
- consistency scoring
- release / review / dispute state machine
- receipt export

#### AgentCache

- identity and policy evidence
- semantic drift / consistency inputs
- browser or retrieval proof where needed

### Shared receipt additions

Suggested fields:

- `identitySnapshotRef`
- `coherenceScore`
- `policyDeviation`
- `releaseDecision`
- `escrowState`
- `reviewReason`

### Phase 1 implementation

1. add consistency metadata to job-order receipts
2. compute a simple coherence score from declared role + route + policy context
3. gate release on thresholded consistency
4. expose escrow evidence bundle in MaxxEval

### Acceptance metrics

- number of escrowed jobs
- % auto-released
- % sent to review
- dispute rate
- consistency score distribution

## What We Are Explicitly Not Building Yet

These ideas stay out of the current roadmap:

- Semiotic Futures Exchange
- Drift Séance as a product line
- Singularity Karaoke
- full Ambient Taxation
- full Orphan Registry
- full Reincarnation Broker

Reason:

They are interesting, but they are not the shortest path to revenue, design
partners, or trust differentiation in the current business.

## Cross-Repo Mapping

### AgentCache.ai

Primary responsibilities:

- pathological execution engine
- uncertainty receipt intake and evidence generation
- semantic consistency signals
- shared receipt canonical definition

Likely files and surfaces:

- `/Users/letstaco/Documents/agentcache-ai/src/contracts/shared-receipt.ts`
- `/Users/letstaco/Documents/agentcache-ai/src/contracts/shared-receipt-builders.ts`
- `/Users/letstaco/Documents/agentcache-ai/src/api/receipts.ts`
- `/Users/letstaco/Documents/agentcache-ai/src/api/internal.ts`
- future `pathological` API router

### MaxxEval

Primary responsibilities:

- scoring and certifications
- trust export
- escrow and release policy
- revenue capture around reports and evidence

Likely files and surfaces:

- `/Users/letstaco/Documents/maxxeval/src/lib/payments/execution-receipts.ts`
- `/Users/letstaco/Documents/maxxeval/src/app/api/x402/v1/trustops/runs/[runId]/receipt/route.ts`
- job-order and escrow routes
- trust profile routes

## Recommended Build Order

### Now

1. Pathological API
2. Honest Uncertainty Receipts
3. Identity-Consistency Escrow

### Next

4. pathological certification exports in MaxxEval
5. honesty-weighted trust ranking
6. escrow review bundles

### Later

7. broader ecosystem primitives such as orphan registry or ambient taxation

## Revenue Fit

### Pathological API

Best monetization:

- usage-priced hardening runs
- certification report fees
- enterprise robustness subscriptions

### Honest Uncertainty Receipts

Best monetization:

- retrieval/proof resolution fees
- trust profile upgrades
- paid audit exports

### Identity-Consistency Escrow

Best monetization:

- escrow fees
- dispute/review fees
- premium trust-backed workflow pricing

## Decision

If we only pursue one of these immediately, choose:

`Pathological API`

If we pursue two, choose:

- `Pathological API`
- `Honest Uncertainty Receipts`

If we pursue all three, sequence them so escrow is third, not first.

That gives us:

- a hardening product
- a trust differentiator
- an economic control layer

in the right order.
