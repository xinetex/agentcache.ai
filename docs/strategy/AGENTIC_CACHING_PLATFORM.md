# Agentic Caching Platform

## Thesis

AgentCache.ai should be positioned as the ontology-aware memory, cache, and evidence fabric for production agents.

The company story is not "general AI platform" and not "HPC vendor." The product sits between agent runtimes on the northbound side and storage, databases, and browser/data infrastructure on the southbound side.

MaxxEval can monetize trust, pricing, and commerce around this layer, but AgentCache should own the semantic namespace, freshness logic, and signed evidence path.

## Product Definition

### Northbound

- Agent-native cache APIs
- Tool-call and retrieval reuse
- Shared multi-agent memory
- Browser proof and evidence receipts
- Sector-aware policy recommendation

### Southbound

- Redis and key-value stores
- Object storage and document stores
- Vector and semantic retrieval systems
- Browser/data extraction systems
- Enterprise/HPC-aligned storage connectors over time

## Launch Wedges

### 1. Enterprise Copilot Fabric

- Buyer: enterprise teams deploying internal copilots
- Painkiller: lower RAG cost, lower latency, better workspace-level reuse
- Product surface: shared semantic cache, workspace namespace policy, browser proof, trust/evidence traces

### 2. Finance Memory Fabric

- Buyer: fintech, quant, risk, KYC, and operations teams
- Painkiller: repeated expensive queries, freshness sensitivity, audit requirements
- Product surface: low-TTL cache policy, audit-weighted evidence, finance ontology routing, browser proof for market/compliance verification

Healthcare remains attractive, but it should follow after the finance wedge is commercially proven.

## Platform Moat

The moat is not generic caching. It is:

- versioned sector ontologies
- sector TTL and freshness control
- cross-sector bridge logic
- signed provenance and browser proof
- trust-aware downstream commercialization

That combination makes the cache fabric defensible because it is semantic, regulated, and economically measurable.

## Repo Mapping

### Existing backbone

- `src/ontology/OntologyRegistry.ts`
- `src/ontology/OntologyBridge.ts`
- `src/ontology/OntologyCacheStrategy.ts`
- `src/services/SemanticCacheService.ts`
- `src/api/cache.ts`
- `src/api/internal.ts`
- `src/services/OntologyProvenanceService.ts`

### New control surface

- `src/config/fabricSkus.ts`
- `src/services/MemoryFabricPolicyService.ts`

These turn the ontology layer into an actual product contract instead of an internal capability.

## Core Metrics

- cache hit rate by SKU and sector
- p50 and p95 latency reduction
- cost saved per 1k tasks
- policy coverage rate on cache writes
- evidence coverage rate on paid/provider flows
- sector-specific freshness violations

## 90-Day Build Order

1. Ship policy-aware `cache/get`, `cache/set`, and `cache/check`
2. Sell `enterprise-copilot` and `finance-memory-fabric` as first-class SKUs
3. Add policy-aware analytics and ROI dashboards
4. Add storage tiering and retention controls by sector
5. Expand provider connectors and browser proof-backed evidence bundles

## Non-Goals

- Becoming a generic orchestration platform
- Leading with HPC branding before customer pull exists
- Treating ontology as a static taxonomy instead of a control plane
