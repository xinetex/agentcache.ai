# Operations Verification Lane

This repo now treats a small set of operational scripts as supported code instead of leaving all scripts outside the type system.

## Purpose

The main app typecheck intentionally excludes `scripts/` because the directory contains a large amount of historical, experimental, and one-off verification code. That keeps the maintained runtime healthy, but it can also overstate correctness if no operational tooling is validated at all.

The operations verification lane closes that gap by defining a curated set of scripts we are prepared to support and typecheck continuously.

## Supported Scripts

- `scripts/industrial_audit.ts`
  - Exercises telemetry, resonance, conflict handling, and policy blocking.
- `scripts/verify_collective_state.ts`
  - Exercises the maintained Collective Cortex session/indexing path.
- `scripts/verify_marketplace.ts`
  - Exercises the marketplace purchase and access-grant path.

## Compiler Contract

- Main app lane:
  - `npx tsc --noEmit --pretty false`
- Operations lane:
  - `npm run typecheck:ops`

The operations lane uses [tsconfig.operations.json](/Users/letstaco/Documents/agentcache-ai/tsconfig.operations.json), which extends the main project config and adds only the curated scripts above.

## Why This Exists

- Keeps the main application build stable.
- Makes supported operational tooling part of the correctness story.
- Avoids pretending that every historical script in `scripts/` is maintained.
- Creates an explicit graduation path: a script becomes supported only when we are willing to keep it green under `typecheck:ops`.

## Graduation Rule

A script should enter this lane only if it satisfies all of the following:

- It targets an actively maintained subsystem.
- It uses current runtime/service contracts.
- It is useful for production verification or operator workflows.
- We are willing to fix it when related code changes.

## Non-Goals

- This lane does not certify every script in `scripts/`.
- This lane does not replace runtime/integration tests.
- This lane does not bless destructive migration utilities as production-safe.
