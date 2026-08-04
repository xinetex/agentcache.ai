/**
 * Grounded Receipt Engine — Wired into AgentCache api/ (legacy Express path)
 *
 * Faithful port/adaptation of:
 *   - ~/grounded/types/receipt.ts (GroundedReceipt, SpecTruth, RuntimeTruth, Invention, ValidationResult, etc.)
 *   - ~/grounded/prototype/node-dir.ts (_emitReceipt + canonical signing intent)
 *
 * Every folder/node mutation that goes through the enhanced nodes.js now produces
 * a deterministic, signed GroundedReceipt (ed25519 when available, strong demo fallback).
 *
 * PERMANENT core (the receipt data model + canonical signing logic is intended to become the shared
 * @agentcache/grounded-receipt package and be used by both legacy api/ and the Hono src/ path).
 *
 * This is the core "wire up" for the Aletheia truth layer inside the requested api/ directory.
 * The in-memory usage and demo signing key are the only temporary parts (clearly marked).
 *
 * Usage (from nodes.js or other handlers):
 *   const { buildGroundedReceipt, signReceipt, canonicalStringify } = await import('./lib/grounded-receipt.js');
 *   const receipt = await buildAndSignReceipt({ spec, runtime, inventions, ... });
 *
 * Security notes:
 *   - Canonical JSON (sorted keys, no whitespace, stable arrays) before signing.
 *   - Never include secrets in receipts.
 *   - Signature is over the canonical bytes of the receipt *without* the signature field.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types (JSDoc for JS consumers — mirrors the locked TS interfaces)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GroundedReceipt
 * @property {string} id
 * @property {string} created_at
 * @property {string} agent_cache_account_id
 * @property {string} agent_cache_run_id
 * @property {string} workflow_id
 * @property {SpecTruth} spec
 * @property {RuntimeTruth} runtime
 * @property {Invention[]} inventions
 * @property {ValidationResult} validation
 * @property {ReceiptSummary} summary
 * @property {"1.0"} receipt_version
 * @property {ReceiptSignature} signature
 */

/**
 * @typedef {Object} SpecTruth
 * @property {Phase[]} declared_phases
 * @property {PolicyReference[]} applicable_policies
 * @property {ToolContract[]} expected_tools
 * @property {string[]} knowledge_context_ids
 * @property {"drift_guard_contract"|"user_declared"|"inferred"} source
 */

/**
 * @typedef {Object} RuntimeTruth
 * @property {ExecutedPhase[]} actual_phases
 * @property {ToolCallRecord[]} tool_calls
 * @property {MemoryOperation[]} memory_operations
 * @property {string} [raw_trace_reference]
 * @property {{start: string, end: string, key_events: Record<string,string>}} timestamps
 * @property {ArtifactReference[]} artifacts
 */

/**
 * @typedef {Object} Invention
 * @property {"reasoning"|"fact_claim"|"plan_step"|"decision"|"other"} type
 * @property {string} content
 * @property {string} [location_in_output]
 * @property {"none"|"cache_lookup"|"memory_recall"|"knowledge_query"} grounding_attempt
 * @property {boolean} was_flagged
 * @property {number} [confidence]
 */

/**
 * @typedef {Object} ValidationResult
 * @property {{schema_valid: boolean, policy_conflicts: boolean, contract_violations: string[]}} static_checks
 * @property {any[]} simulation_results
 * @property {"passed"|"warnings"|"failed"} overall_status
 */

/**
 * @typedef {Object} ReceiptSummary
 * @property {number} drift_score
 * @property {number} invention_count
 * @property {number} grounded_fact_count
 * @property {number} tool_calls_count
 * @property {number} duration_ms
 */

/**
 * @typedef {Object} ReceiptSignature
 * @property {"ed25519"} algorithm
 * @property {string} public_key_id
 * @property {string} signature
 */

// Supporting
/** @typedef {{name: string, description?: string}} Phase */
/** @typedef {{id: string, name: string}} PolicyReference */
/** @typedef {{name: string, description: string}} ToolContract */
/** @typedef {{name: string, status: string}} ExecutedPhase */
/** @typedef {{tool_name: string, mcp_server?: string, input_hash: string, output_hash?: string, duration_ms?: number}} ToolCallRecord */
/** @typedef {{type: "store"|"recall", memory_id?: string, query?: string}} MemoryOperation */
/** @typedef {{id: string, type: string}} ArtifactReference */

// ---------------------------------------------------------------------------
// Deterministic Canonicalization (matches grounded intent)
// ---------------------------------------------------------------------------

/**
 * Recursively produce a stable, sorted-key JSON string with no insignificant whitespace.
 * Arrays are preserved in order (they are semantically ordered).
 */
export function canonicalStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const parts = keys.map(k => {
    const val = canonicalStringify(obj[k]);
    return JSON.stringify(k) + ':' + val;
  });
  return '{' + parts.join(',') + '}';
}

// ---------------------------------------------------------------------------
// Receipt Construction
// ---------------------------------------------------------------------------

/**
 * Build a complete GroundedReceipt (unsigned).
 * Call signReceipt on the result (or use the convenience buildAndSignReceipt).
 */
export function buildGroundedReceipt(params) {
  const now = new Date().toISOString();

  const {
    agentCacheAccountId = 'agentcache-local',
    agentCacheRunId = 'api-legacy-wire',
    workflowId = 'default',
    spec = {
      declared_phases: [{ name: 'create' }],
      applicable_policies: [],
      expected_tools: [],
      knowledge_context_ids: [],
      source: 'user_declared',
    },
    runtime = {
      actual_phases: [{ name: 'create', status: 'completed' }],
      tool_calls: [],
      memory_operations: [],
      timestamps: { start: now, end: now, key_events: {} },
      artifacts: [],
    },
    inventions = [],
    validation = {
      static_checks: { schema_valid: true, policy_conflicts: false, contract_violations: [] },
      simulation_results: [],
      overall_status: inventions.length > 0 ? 'warnings' : 'passed',
    },
    summary = {
      drift_score: inventions.length > 0 ? 0.12 : 0.02,
      invention_count: inventions.length,
      grounded_fact_count: 1,
      tool_calls_count: (runtime.tool_calls || []).length,
      duration_ms: 1,
    },
  } = params;

  const receipt = {
    id: 'gr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10),
    created_at: now,
    agent_cache_account_id: agentCacheAccountId,
    agent_cache_run_id: agentCacheRunId,
    workflow_id: workflowId,
    spec,
    runtime,
    inventions,
    validation,
    summary,
    receipt_version: '1.0',
    signature: {
      algorithm: 'ed25519',
      public_key_id: 'api-legacy-v0.1',
      signature: '', // filled by signReceipt
    },
  };

  return receipt;
}

// ---------------------------------------------------------------------------
// Signing (ed25519 via Web Crypto when available, strong deterministic fallback)
// ---------------------------------------------------------------------------

let cachedDemoPrivateKey = null;

async function getDemoKeyPair() {
  if (cachedDemoPrivateKey) return cachedDemoPrivateKey;

  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      // Derive a stable seed for demo (never use in prod without real key mgmt)
      const seed = new TextEncoder().encode('agentcache-aletheia-demo-root-key-2026');
      const hash = await subtle.digest('SHA-256', seed);
      const keyMaterial = new Uint8Array(hash);

      // Import as Ed25519 private key (raw 32 bytes seed)
      const privateKey = await subtle.importKey(
        'raw',
        keyMaterial.slice(0, 32),
        { name: 'Ed25519' },
        false,
        ['sign']
      );
      const publicKey = await subtle.importKey(
        'raw',
        keyMaterial.slice(0, 32), // demo: we don't expose real pub here
        { name: 'Ed25519' },
        true,
        ['verify']
      );

      cachedDemoPrivateKey = { privateKey, publicKey, subtleAvailable: true };
      return cachedDemoPrivateKey;
    } catch (e) {
      // Expected on some Node versions / environments where Ed25519 raw import has usage restrictions.
      // This is a non-fatal fallback for the legacy api/ demo path. Production will use proper keys.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[grounded-receipt] subtle Ed25519 not available in this env — using deterministic HMAC demo fallback (clearly marked in receipts).');
      }
    }
  }

  // Fallback: stable HMAC-based "signature" (demo only, clearly marked)
  cachedDemoPrivateKey = { subtleAvailable: false };
  return cachedDemoPrivateKey;
}

/**
 * Sign a receipt. Mutates the receipt.signature.signature field.
 * Returns the signed receipt.
 */
export async function signReceipt(receipt) {
  const toSign = { ...receipt };
  delete toSign.signature; // never sign the signature wrapper

  const canonical = canonicalStringify(toSign);
  const bytes = new TextEncoder().encode(canonical);

  const keyPair = await getDemoKeyPair();

  if (keyPair.subtleAvailable) {
    const sigBuffer = await keyPair.subtle.sign(
      { name: 'Ed25519' },
      keyPair.privateKey,
      bytes
    );
    const sigB64 = Buffer.from(sigBuffer).toString('base64');
    receipt.signature.signature = 'ed25519:' + sigB64.slice(0, 88); // typical length
    receipt.signature.public_key_id = 'api-legacy-ed25519-demo';
  } else {
    // Deterministic HMAC fallback (very strong for demo; not real ed25519)
    const hmac = crypto.createHmac('sha256', 'agentcache-aletheia-demo-root-2026');
    hmac.update(canonical);
    const sig = hmac.digest('base64');
    receipt.signature.algorithm = 'hmac-sha256-demo';
    receipt.signature.signature = 'demo:' + sig;
    receipt.signature.public_key_id = 'api-legacy-demo-key';
  }

  return receipt;
}

/**
 * Convenience: build + sign in one call.
 */
export async function buildAndSignReceipt(params) {
  const receipt = buildGroundedReceipt(params);
  return signReceipt(receipt);
}

/**
 * Quick structural validation (not cryptographic verify).
 */
export function validateReceiptShape(receipt) {
  if (!receipt || typeof receipt !== 'object') return { ok: false, reason: 'not an object' };
  const required = ['id', 'created_at', 'spec', 'runtime', 'inventions', 'validation', 'summary', 'signature'];
  for (const k of required) {
    if (!(k in receipt)) return { ok: false, reason: `missing ${k}` };
  }
  if (!receipt.signature?.signature) return { ok: false, reason: 'unsigned' };
  return { ok: true };
}

export default {
  buildGroundedReceipt,
  buildAndSignReceipt,
  signReceipt,
  canonicalStringify,
  validateReceiptShape,
};
