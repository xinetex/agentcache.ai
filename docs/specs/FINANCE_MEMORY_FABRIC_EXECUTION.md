# Finance Memory Fabric Execution

## Goal

Launch the first verticalized AgentCache SKU as a production-grade policy layer for finance agents and retrieval-heavy enterprise copilots.

## Product Contract

### SKU

- `finance-memory-fabric`

### Primary outcomes

- keep finance cache freshness bounded by ontology TTL
- isolate finance workloads from unrelated cache collisions
- emit policy metadata that downstream trust and billing systems can consume
- make browser proof and audit-style evidence easy to pair with cache operations

## Implemented Surfaces

### APIs

- `GET /api/cache/fabric/skus`
- `POST /api/cache/fabric/profile`
- `POST /api/cache/check`
- `POST /api/cache/get`
- `POST /api/cache/set`

### Internal/provider APIs

- `POST /api/internal/cache/get`
- `POST /api/internal/cache/set`

## Data and Control Repositories

### Source of truth

- Sector ontology and freshness: `src/ontology/OntologyRegistry.ts`
- SKU definitions: `src/config/fabricSkus.ts`
- Policy resolution: `src/services/MemoryFabricPolicyService.ts`
- Cache execution: `src/services/SemanticCacheService.ts`
- Provider provenance: `src/services/OntologyProvenanceService.ts`

### Contract surfaces

- Public cache API: `src/api/cache.ts`
- Provider cache API: `src/api/internal.ts`
- Product catalog: `src/api/catalog.ts`

## Policy Rules

### Finance

- default SKU: `finance-memory-fabric`
- sector TTL cap: `300s`
- evidence mode: `audit`
- namespace mode: private if plan allows, shared otherwise
- storage tier:
  - `hot` for <= 15 minutes
  - `warm` for <= 24 hours
  - `cold` above that

### Enterprise Copilot

- default SKU outside finance/healthcare
- focus on semantic reuse and workspace-level memory sharing

## Correctness Guardrails

- cache keys must include sector when sector-aware policy is used
- requested TTL cannot exceed ontology freshness or plan limits
- responses should surface resolved policy, not only raw cache outcome
- provider routes should return the same policy semantics as public routes

## Next Code Steps

1. Persist policy metadata alongside observability and receipt events
2. Add per-SKU analytics counters and ROI dashboards
3. Wire browser proof into finance policy bundles by default
4. Expose policy coverage and freshness compliance in MaxxEval
5. Add healthcare-specific PHI/clinical policy enforcement after finance proves demand
