// lib/auth.js
//
// AgentCache — single canonical auth surface (Move 3: consolidation).
//
// The repo grew FOUR overlapping auth modules on two different identity models:
//
//   lib/api-key-middleware.js  — ac_ keys -> neon `organizations` (org UUID).
//                                Used by the cache/analytics/governance path.
//                                THIS IS CANONICAL.
//   lib/auth-unified.js        — Redis key-hash -> tier. Used by the L3
//                                semantic path (withAuth). LEGACY.
//   lib/auth-middleware.js     — older wrapper. LEGACY.
//   lib/validate-api-key.js    — older validator. LEGACY.
//
// New code imports auth from HERE and nowhere else. That gives us one import to
// migrate the legacy callers onto before the other three files can be deleted —
// a safe, reversible path instead of a risky big-bang delete across 246
// endpoints. See AUTH_CONSOLIDATION.md.

export {
  validateApiKey,
  validateNamespaceAccess,
  withApiKeyAuth,
  recordUsage,
  getApiKeyContext,
  getNamespace,
} from './api-key-middleware.js';

// Legacy bridge — the Redis-key-hash scheme behind the L3 semantic cache.
// Exposed under an explicit name so its use is visible and greppable while the
// two identity systems are unified. Prefer the canonical exports above.
export { withAuth as withLegacyAuth } from './auth-unified.js';

export const AUTH_CANONICAL = 'api-key-middleware';
