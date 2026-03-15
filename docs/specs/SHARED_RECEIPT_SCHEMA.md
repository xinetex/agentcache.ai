# Shared Receipt Schema

Status: Draft v1  
Schema ID: `agentic.shared-receipt.v1`  
Canonical implementation: [shared-receipt.ts](/Users/letstaco/Documents/agentcache-ai/src/contracts/shared-receipt.ts)

## Purpose

This schema normalizes execution, trust, telemetry, and economic evidence across:

- `agentcache-ai`
- `maxxeval`
- `jettyagent` / `clawsave.com`
- future verticals such as `symbiont.legal`

It is intentionally lightweight enough to fit inside existing receipt stores such as MaxxEval `ExecutionReceipt.metadataJson` while still being rich enough to represent MaxxPoly bot cycles, browser proofs, trust exports, and provider-backed API calls.

## Core Fields

### `schema`

- fixed string
- value: `agentic.shared-receipt.v1`

### `receiptId`

- globally unique logical receipt identifier
- should be stable enough to deduplicate upstream/downstream ingestion

### `issuedAt`

- ISO timestamp

### `producer`

- the system or agent that emitted the receipt
- includes `system`, `id`, and optional role/profile/wallet fields

### `subject`

- what the receipt is about
- includes `kind`, `id`, and optional `ref` or `route`

### `operation`

- the action that occurred
- includes `action` plus optional `provider`, `route`, `method`, and `environment`

### `ontology`

- optional semantic frame
- includes sector, ontology ref/version, sign class, confidence, matched terms, and bridge trace

### `economics`

- optional price, revenue, token cost, and latency

### `trust`

- required trust outcome
- includes `verdict` and optional status/anomaly/drift/confidence

### `evidence`

- optional hashes, attachments, and external references

### `telemetry`

- optional system-specific measurements and metrics

### `refs`

- optional related entity ids such as job order, tx hash, cycle id, account, run id, or market id

### `payload`

- optional compact business payload
- should contain only the minimum useful normalized summary, not entire raw upstream blobs

### `signature`

- optional HMAC signature over the unsigned envelope

## Usage Rules

1. Do not change field meanings per system.
2. Prefer adding optional fields inside `telemetry`, `refs`, or `payload` before creating `v2`.
3. `trust.verdict` must always be present even for informational receipts.
4. Receipts should include ontology metadata whenever the operation is sector-specific.
5. The same logical event may be stored in different persistence systems, but the `receiptId` should remain stable.

## Current Intended Producers

### AgentCache

- browser proof
- provider trust status
- cache operations
- ontology provenance

### MaxxEval

- paid x402 exports
- job delivery and settlement
- trust and profile reads that generate billable evidence

### ClawSave / JettyAgent

- MaxxPoly status snapshots
- MaxxPoly performance snapshots
- MaxxPoly cycle/trade receipts

## Persistence Mapping

### MaxxEval `ExecutionReceipt`

- `provider` = producer/provider system
- `sourceType` = origin class
- `subjectType` = mapped from `subject.kind`
- `subjectRef` = receipt id or subject ref
- `payloadHash` = hash of receipt or receipt payload
- `metadataJson.sharedReceipt` = full normalized envelope

### JettyAgent

- route response payload
- cache/memory persistence
- optional JSONL export

### AgentCache

- canonical schema definition
- future validation and bridge tooling
