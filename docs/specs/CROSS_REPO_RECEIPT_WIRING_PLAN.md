# Cross-Repo Receipt Wiring Plan

Status: Ready for implementation  
Date: 2026-03-14

## Goal

Wire `jettyagent` and `maxxeval` into AgentCache shared receipts without touching the MaxxPoly trading loop.

## Naming Decision

Public-facing producer identity:

- `maxxeval.com`

Technical producer system values:

- `JETTYAGENT` for runtime-origin receipts emitted by JettyAgent
- `MAXXEVAL` for trust/export receipts emitted by MaxxEval

Use:

- `producer.system` for technical provenance
- `producer.id` for public identity

## Safe Integration Shape

### JettyAgent

Add a new readonly route:

- `/api/maxxeval/receipts`

This route should:

- call existing readonly sources:
  - `/api/maxxpoly/status`
  - `/api/maxxpoly/performance`
- build `agentic.shared-receipt.v1` envelopes
- optionally sign them with `SHARED_RECEIPT_SECRET`
- return an array of receipts

This does not alter:

- trading logic
- risk gates
- control actions
- order placement

### MaxxEval

Add an AgentCache relay helper that:

- builds a shared receipt envelope for paid exports
- optionally signs it with `SHARED_RECEIPT_SECRET`
- POSTs it to AgentCache:
  - `POST /api/receipts/ingest`

Use env vars:

- `AGENTCACHE_RECEIPT_INGEST_URL`
- `AGENTCACHE_RECEIPT_API_KEY`
- `SHARED_RECEIPT_SECRET`

Relay failures should never break the existing paid route response.

## First MaxxEval Receipt Producers

### TrustOps receipt export

File:

- `/Users/letstaco/Documents/maxxeval/src/app/api/x402/v1/trustops/runs/[runId]/receipt/route.ts`

Producer shape:

- `producer.system = 'MAXXEVAL'`
- `producer.id = 'maxxeval.com'`
- `subject.kind = 'TRUST_EXPORT'`

### AgentCache provider trust status export

File:

- `/Users/letstaco/Documents/maxxeval/src/app/api/x402/v1/agentcache/trust/status/route.ts`

Producer shape:

- `producer.system = 'MAXXEVAL'`
- `producer.id = 'maxxeval.com'`
- `subject.kind = 'API_CALL'`

## First JettyAgent Receipt Producers

### Status snapshot

Source:

- `/api/maxxpoly/status`

Producer shape:

- `producer.system = 'JETTYAGENT'`
- `producer.id = 'maxxeval.com'`
- `subject.kind = 'STATUS_SNAPSHOT'`

### Performance snapshot

Source:

- `/api/maxxpoly/performance`

Producer shape:

- `producer.system = 'JETTYAGENT'`
- `producer.id = 'maxxeval.com'`
- `subject.kind = 'PERFORMANCE_SNAPSHOT'`

## Rollout Order

1. JettyAgent readonly export route
2. MaxxEval relay helper
3. TrustOps export receipt relay
4. AgentCache trust-status receipt relay
5. Hetzner-side relay job if needed later

## Acceptance Criteria

- AgentCache lists JettyAgent-exported receipts under `producer.id = maxxeval.com`
- AgentCache lists MaxxEval trust receipts under `producer.id = maxxeval.com`
- `/api/stats` and `/api/observability/stats` show receipt counts increasing
- MaxxPoly runtime remains untouched and disabled until secrets/runtime are ready

## Current Blocker

The remaining code changes belong in:

- `/Users/letstaco/Documents/jettyagent`
- `/Users/letstaco/Documents/maxxeval`

Those repos are outside the current writable workspace, so local edits need elevated permission or a workspace change before the patch can be applied directly from here.
