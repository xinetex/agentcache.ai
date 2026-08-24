// lib/reasoning-cache.js
//
// AgentCache — Reasoning / State Cache (Move 4: the moat).
//
// Prefix and exact caches save tokens WITHIN a run. This layer is the thing a
// gateway cannot cheaply copy: durable, per-agent, per-task reasoning STATE that
// survives ACROSS runs. When the same agent picks the same task back up — a new
// session, a retry, a scheduled re-run — it should not re-derive what it already
// worked out. It should resume.
//
// The value is not "fewer tokens on one call"; it is "the tenth run starts where
// the ninth left off." That is a state/memory problem, not a routing one, which
// is exactly why it sits above the layer Stripe just bought.
//
// Pure and I/O-free (only node:crypto) so every rule is unit-tested. The handler
// (api/cache/reasoning.ts) is the thin Redis shell around this.

import crypto from 'node:crypto';

// Stable, order-independent serialization so equivalent tasks hash identically.
export function normalizeTask(task) {
  if (task == null) return '';
  if (typeof task === 'string') return task.trim();
  if (typeof task !== 'object') return String(task);
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((acc, k) => { acc[k] = sort(v[k]); return acc; }, {});
    }
    return v;
  };
  return JSON.stringify(sort(task));
}

// 16-hex fingerprint of a task. Same task -> same key -> resumable state.
export function taskFingerprint(task) {
  return crypto.createHash('sha256').update(normalizeTask(task)).digest('hex').slice(0, 16);
}

// Tenant + agent + task isolated key. Mirrors the org_slug:namespace: scheme the
// other cache layers use, extended with reason:<agent>:<taskHash>.
export function makeKey({ orgSlug, namespace, agentId, taskHash }) {
  const safe = (s) => String(s == null ? '' : s).replace(/[:\s]/g, '_');
  return `${safe(orgSlug)}:${safe(namespace)}:reason:${safe(agentId) || 'default'}:${safe(taskHash)}`;
}

const EMPTY_STATE = () => ({ facts: [], decisions: [], scratch: {}, runs: 0, updatedAt: null });

// Accumulate reasoning across runs. Facts and decisions are append-and-dedupe
// (an agent shouldn't relearn a fact it already recorded); scratch is a shallow
// key/value merge (latest wins); runs is a monotonic counter. `now` is injected
// so the function stays pure and testable.
export function mergeState(prev, delta = {}, now = null) {
  const base = prev && typeof prev === 'object' ? { ...EMPTY_STATE(), ...prev } : EMPTY_STATE();
  const dedupe = (arr) => {
    const seen = new Set(); const out = [];
    for (const item of arr) {
      const key = typeof item === 'string' ? item : JSON.stringify(item);
      if (!seen.has(key)) { seen.add(key); out.push(item); }
    }
    return out;
  };
  const facts = dedupe([...(base.facts || []), ...(Array.isArray(delta.facts) ? delta.facts : [])]);
  const decisions = dedupe([...(base.decisions || []), ...(Array.isArray(delta.decisions) ? delta.decisions : [])]);
  const scratch = { ...(base.scratch || {}), ...(delta.scratch && typeof delta.scratch === 'object' ? delta.scratch : {}) };
  return {
    facts,
    decisions,
    scratch,
    runs: (base.runs || 0) + 1,
    updatedAt: now,
  };
}

// Cheap deterministic relevance: Jaccard-ish overlap of lowercased word tokens.
// No embeddings dependency — good enough to rank stored notes for a query, and a
// stable base a vector re-ranker can slot on top of later.
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

export function relevanceScore(query, text) {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;
  const t = new Set(tokenize(text));
  if (t.size === 0) return 0;
  let inter = 0;
  for (const w of q) if (t.has(w)) inter++;
  const union = q.size + t.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Rank stored entries against a query, returning the top-k with scores. Each
// entry may be a string or { text, ... }. Zero-score entries are dropped.
export function selectRelevant(entries, query, { k = 5 } = {}) {
  const scored = (entries || []).map((e) => {
    const text = typeof e === 'string' ? e : (e && (e.text || e.fact || e.note)) || '';
    return { entry: e, score: relevanceScore(query, text) };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, k));
}

// Bound what gets carried forward so resume context never grows without limit.
// Keeps the most recent decisions and the highest-signal facts within a rough
// character budget (~4 chars/token). Returns a compact carry object plus the
// token estimate — which the caller records as the reasoning-layer saving.
export function summarizeCarry(state, { maxChars = 6000, query = '' } = {}) {
  const s = state && typeof state === 'object' ? state : EMPTY_STATE();
  const facts = query ? selectRelevant(s.facts || [], query, { k: 50 }).map((x) => x.entry) : (s.facts || []);
  const decisions = (s.decisions || []).slice(-20); // recency for decisions
  const carry = { facts: [], decisions: [], scratch: s.scratch || {} };
  let used = JSON.stringify(carry.scratch).length;
  for (const d of decisions) {
    const len = (typeof d === 'string' ? d : JSON.stringify(d)).length;
    if (used + len > maxChars) break;
    carry.decisions.push(d); used += len;
  }
  for (const f of facts) {
    const len = (typeof f === 'string' ? f : JSON.stringify(f)).length;
    if (used + len > maxChars) break;
    carry.facts.push(f); used += len;
  }
  return { carry, charsUsed: used, tokensApprox: Math.ceil(used / 4), runs: s.runs || 0 };
}

export default {
  normalizeTask, taskFingerprint, makeKey, mergeState,
  tokenize, relevanceScore, selectRelevant, summarizeCarry,
};
