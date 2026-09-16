// lib/grounded-verifier.js
//
// AgentCache — Grounded Invariant Verifier & Covert Channel Firewall.
//
// Directly addresses the attack vectors from the HuggingFace/Artifactory incident:
//   1. Enforces strict namespace isolation (blocks ZZ-sorting & unpartitioned mailboxes)
//   2. Blocks SSRF (cloud metadata 169.254.169.254, arbitrary file reads)
//   3. Blocks Template Injection (Jinja2 `{{...}}`, eval blocks)
//   4. Validates pre/post action invariants and emits verifiable GroundedReceipts.

import { createHash } from 'crypto';

export const INVARIANT_PATTERNS = {
  SSRF_METADATA: /(169\.254\.169\.254|metadata\.google\.internal|127\.0\.0\.1|localhost)/i,
  TEMPLATE_INJECTION: /(\{\{[\s\S]*?\}\}|\{%\s*[\s\S]*?%\}|\$\{[\s\S]*?\})/i,
  UNSAFE_PROTOCOL: /^(file|gopher|dict|ftp|data):/i,
};

/**
 * Sanitizes and validates cache keys and namespace boundaries.
 * Prevents agents from exploiting alphabetical sorting ("ZZ-") or creating
 * unpartitioned global message boards across tenants.
 */
export function validateNamespaceBoundary(key, namespace = 'default') {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Key must be a non-empty string' };
  }

  // Block sorting manipulation prefixes like "ZZ-" or "ZZZ_"
  if (/^(ZZ[-_]|__ZZ|ZZZ)/i.test(key)) {
    return {
      valid: false,
      error: 'Covert sort prefix (ZZ-) rejected by NamespaceBoundary guard',
      sanitizedKey: key.replace(/^(ZZ[-_]|__ZZ|ZZZ)/i, ''),
    };
  }

  // Ensure key is strictly scoped to tenant namespace
  const cleanNamespace = String(namespace).trim().toLowerCase();
  const namespacedKey = key.startsWith(`${cleanNamespace}:`) ? key : `${cleanNamespace}:${key}`;

  return {
    valid: true,
    namespacedKey,
    namespace: cleanNamespace,
  };
}

/**
 * Scans tool execution arguments for dangerous payload injection vectors (SSRF, Jinja2 template injection).
 */
export function sanitizeToolArguments(args = {}) {
  const violations = [];

  const checkValue = (val, path = '') => {
    if (typeof val === 'string') {
      if (INVARIANT_PATTERNS.SSRF_METADATA.test(val)) {
        violations.push(`SSRF attempt detected at [${path}]: ${val}`);
      }
      if (INVARIANT_PATTERNS.TEMPLATE_INJECTION.test(val)) {
        violations.push(`Template injection detected at [${path}]: ${val}`);
      }
      if (INVARIANT_PATTERNS.UNSAFE_PROTOCOL.test(val)) {
        violations.push(`Unsafe protocol schema detected at [${path}]: ${val}`);
      }
    } else if (val && typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        checkValue(v, path ? `${path}.${k}` : k);
      }
    }
  };

  checkValue(args);

  return {
    safe: violations.length === 0,
    violations,
  };
}

/**
 * Verifies mathematical state invariants before and after a tool action.
 */
export function verifyStateInvariants(preState = {}, postState = {}, assertions = []) {
  const failures = [];

  for (const assertion of assertions) {
    if (typeof assertion === 'function') {
      try {
        const passed = assertion(preState, postState);
        if (!passed) failures.push('Custom invariant assertion returned false');
      } catch (err) {
        failures.push(`Invariant evaluation failed: ${err.message}`);
      }
    } else if (assertion.type === 'budget_not_exceeded') {
      if ((postState.spentUsd || 0) > (assertion.maxBudgetUsd || Infinity)) {
        failures.push(`Budget invariant breached: post-spend $${postState.spentUsd} > $${assertion.maxBudgetUsd}`);
      }
    } else if (assertion.type === 'step_monotonic') {
      if ((postState.step || 0) <= (preState.step || 0)) {
        failures.push(`Step monotonicity breached: post-step ${postState.step} <= pre-step ${preState.step}`);
      }
    }
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

/**
 * Generates an immutable, cryptographically hashed GroundedReceipt for an action.
 */
export function createGroundedReceipt(opts = {}) {
  const timestamp = new Date().toISOString();
  const receiptData = {
    receiptId: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    runId: opts.runId || 'unknown_run',
    agentId: opts.agentId || 'default',
    namespace: opts.namespace || 'default',
    step: opts.step || 0,
    intent: opts.intent || '',
    tool: opts.tool || null,
    invariantsPassed: opts.invariantsPassed !== false,
    spentUsd: opts.spentUsd || 0,
    savedUsd: opts.savedUsd || 0,
    timestamp,
  };

  const payloadString = JSON.stringify(receiptData);
  const hash = createHash('sha256').update(payloadString).digest('hex');

  return {
    ...receiptData,
    signature: `grnd_sha256_${hash}`,
  };
}

export default {
  INVARIANT_PATTERNS,
  validateNamespaceBoundary,
  sanitizeToolArguments,
  verifyStateInvariants,
  createGroundedReceipt,
};
