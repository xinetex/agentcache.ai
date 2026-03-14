# Memory Fabric Data Repositories

This document defines the source-of-truth repositories for the memory-fabric ROI and accounting layer introduced in the `agentic-caching-platform` branch.

## Purpose

The memory-fabric stack now exposes three distinct kinds of operational state:

1. `Policy`
   Resolved workload and compliance behavior for a request.
2. `Analytics`
   Estimated savings and evidence coverage for reads, writes, and browser-proof operations.
3. `Accounting`
   Estimated credits and billable usage by account and SKU.

These are separate repositories on purpose. Policy answers "how should this request behave," analytics answers "what value did the platform generate," and accounting answers "what usage should be priced."

## Authoritative Repositories

### 1. Policy Repository

Source: [src/services/MemoryFabricPolicyService.ts](/Users/letstaco/Documents/agentcache-ai/src/services/MemoryFabricPolicyService.ts)

Authoritative fields:
- `verticalSku`
- `sectorId`
- `ontologyRef`
- `effectiveTtlSeconds`
- `ttlClamped`
- `storageTier`
- `namespaceMode`
- `complianceTags`
- `evidenceMode`
- `estimatedCredits`

Policy is derived, not persisted as a standalone database row. It is recomputed per request from:
- the requested sector or SKU
- ontology freshness constraints
- the caller tier
- SKU defaults in [src/config/fabricSkus.ts](/Users/letstaco/Documents/agentcache-ai/src/config/fabricSkus.ts)

### 2. Analytics Repository

Source: [src/services/MemoryFabricAnalyticsService.ts](/Users/letstaco/Documents/agentcache-ai/src/services/MemoryFabricAnalyticsService.ts)

Backing store: Redis

Purpose:
- estimate cost avoided
- estimate latency saved
- measure evidence coverage
- measure TTL clamp frequency
- compare performance by SKU and by sector

Redis keys:
- `fabric:analytics:{date}:global`
- `fabric:analytics:{date}:sku:{sku}`
- `fabric:analytics:{date}:sector:{sectorId}`
- `fabric:analytics:{date}:skus`
- `fabric:analytics:{date}:sectors`

Retention:
- `90 days`

### 3. Accounting Repository

Source: [src/services/MemoryFabricBillingService.ts](/Users/letstaco/Documents/agentcache-ai/src/services/MemoryFabricBillingService.ts)

Backing store: Redis

Purpose:
- estimate credits consumed per operation
- estimate billable USD
- isolate account usage from global usage
- support SKU-aware pricing and dashboard reporting

Redis keys:
- `fabric:billing:{date}:global`
- `fabric:billing:{date}:sku:{sku}`
- `fabric:billing:{date}:account:{accountHash}`
- `fabric:billing:{date}:account:{accountHash}:sku:{sku}`
- `fabric:billing:{date}:skus`
- `fabric:billing:{date}:accounts`
- `fabric:billing:{date}:account:{accountHash}:skus`

Retention:
- `90 days`

Privacy and scope:
- `accountHash` is derived from `apiKey` or `accountId` with SHA-256 truncation.
- Account-scoped summaries must read only account-scoped hashes and account-scoped SKU sets.
- Global SKU aggregates must never be returned as account-level `bySku` data.

## Public and Internal Read Paths

### Public APIs

Defined in [src/api/cache.ts](/Users/letstaco/Documents/agentcache-ai/src/api/cache.ts)

- `GET /api/cache/fabric/roi`
  - Returns authenticated `analytics` and authenticated `accounting`
- `POST /api/cache/check`
  - Returns `policy` and per-operation `billing`
- `POST /api/cache/get`
  - Returns `policy` and per-operation `billing`
- `POST /api/cache/set`
  - Returns `policy` and per-operation `billing`

### Internal Provider APIs

Defined in [src/api/internal.ts](/Users/letstaco/Documents/agentcache-ai/src/api/internal.ts)

- `POST /api/internal/cache/get`
- `POST /api/internal/cache/set`
- `POST /api/internal/browser-proof`

These routes record both analytics and accounting under the provider account path.

### Global Observability

Defined in:
- [src/index.ts](/Users/letstaco/Documents/agentcache-ai/src/index.ts)
- [src/api/observability.ts](/Users/letstaco/Documents/agentcache-ai/src/api/observability.ts)

Surfaces:
- `GET /api/stats`
- `GET /api/observability/stats`

These endpoints may expose aggregate `fabric.analytics` and aggregate `fabric.accounting`, but they are not the account-specific source of truth.

## UI Surfaces

- [src/components/dashboard/MemoryFabricROIPanel.tsx](/Users/letstaco/Documents/agentcache-ai/src/components/dashboard/MemoryFabricROIPanel.tsx)
- [src/components/dashboard/IndustrialDashboard.tsx](/Users/letstaco/Documents/agentcache-ai/src/components/dashboard/IndustrialDashboard.tsx)

The dashboard is a consumer of the repositories above. It is not authoritative.

## Invariants

1. Policy must be resolved before analytics or accounting are recorded.
2. Every billable cache or proof operation must record both analytics and accounting, even on cache miss.
3. Account-level summaries must be isolated from global SKU aggregates.
4. TTL clamp events are policy facts and must be counted in analytics.
5. Accounting values are estimated credits, not final invoicing records.

## Operational Notes

- Analytics and accounting are optimized for speed and observability, not ledger-grade settlement.
- If final billing is needed later, it should be derived from signed request receipts plus the accounting aggregates, not from the dashboard alone.
- MaxxEval should consume the authenticated ROI/accounting surfaces as evidence inputs, not recreate these aggregates independently.
