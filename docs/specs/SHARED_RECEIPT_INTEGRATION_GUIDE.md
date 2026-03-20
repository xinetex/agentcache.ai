# Shared Receipt Integration Guide

Status: Active  
Date: 2026-03-14

## Purpose

This guide explains how other repos should emit and ingest `agentic.shared-receipt.v1`.

Canonical code:

- [shared-receipt.ts](/Users/letstaco/Documents/agentcache-ai/src/contracts/shared-receipt.ts)
- [shared-receipt-builders.ts](/Users/letstaco/Documents/agentcache-ai/src/contracts/shared-receipt-builders.ts)
- [receipts.ts](/Users/letstaco/Documents/agentcache-ai/src/api/receipts.ts)

## Current AgentCache API Surface

### Ingest

- `POST /api/receipts/ingest`

### Read

- `GET /api/receipts`
- `GET /api/receipts/:receiptId`
- `GET /api/receipts/summary`

All routes currently require a normal AgentCache API key.

## Environment

### Receiver

- `SHARED_RECEIPT_SECRET`

If configured, signed receipts are verified at ingest time.

### Producer

Use the same `SHARED_RECEIPT_SECRET` value to sign envelopes before transport.

## Transport Rules

1. Keep `receiptId` stable for the same logical event.
2. Sign receipts when systems share a receipt secret.
3. Do not send huge raw blobs inside `payload`.
4. Put large artifacts behind `evidence.refs` or `attachments`.
5. Include ontology data whenever the operation is sector-specific.

## Recommended Producer Mapping

### JettyAgent / ClawSave

Use:

- `buildBotCycleReceipt`
- `buildPerformanceSnapshotReceipt`
- `buildStorageTransferReceipt`

Good subjects:

- `BOT_CYCLE`
- `PERFORMANCE_SNAPSHOT`
- `STORAGE_TRANSFER`
- `TRADE_INTENT`
- `TRADE_EXECUTION`

### MaxxEval

Use:

- `buildApiCallReceipt`
- `buildTrustExportReceipt`

Good subjects:

- `API_CALL`
- `TRUST_EXPORT`

## Minimal JettyAgent Example

```ts
import { buildBotCycleReceipt } from '../contracts/shared-receipt-builders.js';

const receipt = buildBotCycleReceipt({
  receiptId: `maxxpoly-cycle-${cycle.id}`,
  producer: {
    system: 'JETTYAGENT',
    id: 'maxxeval.com',
    role: 'autopilot',
  },
  cycleId: cycle.id,
  ontology: {
    sectorId: 'finance',
    ontologyRef: 'finance@v1',
    confidence: 0.93,
  },
  trust: {
    verdict: 'INFO',
    confidence: 0.81,
  },
  telemetry: {
    pnlUsd: cycle.pnlUsd,
    winRate: cycle.winRate,
  },
  refs: {
    marketId: cycle.marketId,
  },
  secret: process.env.SHARED_RECEIPT_SECRET,
});
```

## Minimal MaxxEval Example

```ts
import { buildTrustExportReceipt } from '../contracts/shared-receipt-builders.js';

const receipt = buildTrustExportReceipt({
  receiptId: `trust-export-${run.id}`,
  producer: {
    system: 'MAXXEVAL',
    id: 'maxxeval.com',
  },
  exportId: run.id,
  route: '/api/x402/v1/trustops/runs/:runId/receipt',
  ontology: {
    sectorId: 'finance',
    ontologyRef: 'finance@v1',
  },
  economics: {
    sku: 'trust-export',
    revenueMicros: 250000,
  },
  trust: {
    verdict: 'PASS',
    confidence: 0.94,
  },
  refs: {
    runId: run.id,
    agentProfileId: run.agentProfileId,
  },
  secret: process.env.SHARED_RECEIPT_SECRET,
});
```

## Minimal JettyThunder / Lyve Example

```ts
import { buildStorageTransferReceipt } from '../contracts/shared-receipt-builders.js';

const receipt = buildStorageTransferReceipt({
  receiptId: `lyve-transfer-${transfer.id}`,
  producer: {
    system: 'JETTYAGENT',
    id: 'maxxeval.com',
    role: 'storage-runtime',
  },
  transferId: transfer.id,
  route: '/api/jetty-speed/chunk',
  provider: 'lyve',
  environment: 'production',
  direction: 'upload',
  storageClass: 'durable-object',
  ontology: {
    sectorId: 'infrastructure',
    ontologyRef: 'storage@v1',
    signClass: 'transfer-proof',
    confidence: 0.9,
  },
  trust: {
    verdict: 'PASS',
    confidence: 0.91,
  },
  refs: {
    fileId: transfer.fileId,
    bucket: transfer.bucket,
    edgeId: transfer.edgeId,
  },
  telemetry: {
    bytesTransferred: transfer.bytesTransferred,
    multipart: transfer.multipart,
  },
  secret: process.env.SHARED_RECEIPT_SECRET,
});
```

Storage receipts should prefer references over raw objects. Keep bucket names, file ids, object keys,
ETags, signed-url refs, and transfer hashes in `refs` or `evidence.attachments`, not full payload blobs.

## Next Cross-Repo Implementation Order

1. `jettyagent` emits readonly `maxxeval.com` bot-cycle, performance, and storage-transfer receipts
2. `maxxeval` emits trust-export and paid-route receipts in the same contract
3. both repos POST those receipts into AgentCache
4. MaxxEval later persists the same envelope inside its own `ExecutionReceipt.metadataJson`

## Operational Goal

Once wired, the same logical event should be:

- produced once
- signed once
- accepted by AgentCache
- readable in stats and receipt APIs
- portable into MaxxEval trust surfaces

## Naming Decision

Use this distinction consistently:

- `producer.system` = technical system enum such as `JETTYAGENT` or `MAXXEVAL`
- `producer.id` = public-facing identity such as `maxxeval.com`

This keeps technical provenance precise while preserving the public brand identity we want attached to the receipts.
