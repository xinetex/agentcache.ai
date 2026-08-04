# Action Packs (Workflow Templates)

This directory contains reusable **Action Packs** — the Aletheia equivalent of Apple Automator Workflows or macOS Shortcuts automations.

An Action Pack defines a triggered sequence of grounded actions that run on files/folders (or smart nodes) and always produce `GroundedReceipt`s for auditability, drift detection, and invention tracking.

## Format

Each pack is a single `.pack.json` file with this structure:

```json
{
  "pack": {
    "id": "unique-pack-id",
    "name": "Human readable name",
    "description": "...",
    "version": "0.1.0",
    "icon": "optional-emoji-or-url",
    "category": "research | legal | finance | media | general"
  },
  "triggers": [
    {
      "type": "file:added" | "file:modified" | "node:write" | "schedule" | "webhook",
      "description": "When this pack should activate"
    }
  ],
  "steps": [
    {
      "id": "step-1",
      "tool": "builtin.classify",           // must match an id from /api/tools
      "inputs": { ... },                    // static or references to previous outputs
      "outputs": ["labels", "suggested_actions"],
      "emits_receipt": true,
      "invention_policy": "flag" | "pause" | "allow"
    }
  ],
  "receipt_requirements": {
    "must_emit": ["classification", "entity_extraction"],
    "summary_drift_threshold": 0.15
  },
  "variables": {
    "optional": "schema for user-configurable values when installing the pack"
  }
}
```

## Installation

Packs can be installed onto a Smart Folder (node) via the existing `/api/templates` mechanism (or future richer pack endpoints). Once installed, the folder will automatically propose or run the pack's steps when triggers fire.

All steps should be built from tools that are already registered in `/api/tools` and must emit `GroundedReceipt`s.

## Goals

- Make folder automation feel like Automator / Shortcuts, but with cryptographic truth.
- Every meaningful step produces a verifiable receipt.
- Packs are portable, versionable, and reviewable.
- High-level domain packs (Research, Legal, Finance) composed from the low-level grounded tools we already wired.

See the example packs in this directory.
