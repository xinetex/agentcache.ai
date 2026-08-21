// lib/swarm-breaker.js
//
// AgentCache — Collective Circuit Breaker (swarm defense).
//
// Per-agent controls miss coordinated risk: thousands of individually
// harmless agents converging on the same endpoint, credential, domain, or
// skill-hash. This governs the AGGREGATE. It maintains a rolling behavior
// graph keyed by (signal, key) and trips — quarantining the cluster — when the
// number of DISTINCT agents converging in the window crosses a threshold.
//
// Signals it correlates:
//   'new-domain'      sudden shared first-contact with a new network destination
//   'account-create'  synchronized account creation
//   'auth-fail'       repeated failed authorization paths
//   'skill-hash'      unusual propagation of the same skill package hash
//
// Deterministic + time-injectable (pass `now`) so it is unit-testable. No deps.

const DEFAULT_THRESHOLDS = {
  'new-domain': 5,
  'account-create': 5,
  'auth-fail': 8,
  'skill-hash': 10,
};

export class SwarmBreaker {
  constructor(opts = {}) {
    this.windowMs = opts.windowMs ?? 60_000;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...(opts.thresholds || {}) };
    // key -> [{ agentId, at }]
    this._hits = new Map();
    // set of tripped keys -> { signal, key, agents, since }
    this._tripped = new Map();
  }

  _key(signal, key) {
    return `${signal}::${key}`;
  }

  _prune(list, now) {
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < list.length && list[i].at < cutoff) i++;
    return i ? list.slice(i) : list;
  }

  // Record one agent's action on a shared key. Returns the current cluster
  // status for that key (including whether it just tripped).
  observe(event) {
    const now = event.now ?? Date.now();
    const signal = event.signal;
    const key = event.key;
    const k = this._key(signal, key);

    let list = this._prune(this._hits.get(k) || [], now);
    list.push({ agentId: event.agentId, at: now });
    this._hits.set(k, list);

    const distinct = new Set(list.map((h) => h.agentId));
    const threshold = this.thresholds[signal] ?? Infinity;
    const tripped = distinct.size >= threshold;

    if (tripped && !this._tripped.has(k)) {
      this._tripped.set(k, { signal, key, agents: [...distinct], since: now });
    }

    return {
      signal,
      key,
      distinctAgents: distinct.size,
      threshold,
      tripped: this._tripped.has(k),
      justTripped: tripped && this._tripped.get(k)?.since === now,
    };
  }

  // Is a given agent currently inside any quarantined cluster?
  isQuarantined(agentId) {
    for (const c of this._tripped.values()) {
      if (c.agents.includes(agentId)) return true;
    }
    return false;
  }

  tripped() {
    return [...this._tripped.values()];
  }

  // Manual clear (e.g. after human review).
  reset(signal, key) {
    this._tripped.delete(this._key(signal, key));
    this._hits.delete(this._key(signal, key));
  }
}
