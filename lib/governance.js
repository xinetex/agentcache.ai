// lib/governance.js
//
// AgentCache — Governance core (Move 2: the control plane).
//
// The reposition thesis in one module. Stripe/OpenRouter own the billing rail;
// they tell you what you spent. Nobody GOVERNS an autonomous agent's spend
// before it happens. This is that gate: deterministic, side-effect-free policy
// evaluation that answers a single question on every proposed model call —
//
//     "Given this org's budget, quota, spend pattern, and kill-switch,
//      should this call be allowed, warned, or blocked?"
//
// Pure by design (no Redis/HTTP/clock) so every decision is unit-testable and
// reproducible. The API handlers are the thin I/O shell around it.

export const SEVERITY = { OK: 'ok', WARN: 'warn', BLOCK: 'block' };

const clampRatio = (n) => (Number.isFinite(n) ? n : 0);

// --- Budget --------------------------------------------------------------
// spentUsd vs budgetUsd, with a warn band before the hard ceiling. estCostUsd
// is the projected cost of the call being evaluated (0 for a pure status read).
export function evaluateSpend({ spentUsd = 0, budgetUsd = 0, estCostUsd = 0, warnRatio = 0.8 } = {}) {
  if (!budgetUsd || budgetUsd <= 0) {
    // No budget set = ungoverned. Report ok but flag unset so the UI can nudge.
    return { state: SEVERITY.OK, ratio: 0, remainingUsd: Infinity, budgetSet: false };
  }
  const projected = spentUsd + Math.max(0, estCostUsd);
  const ratio = clampRatio(projected / budgetUsd);
  const remainingUsd = round6(budgetUsd - spentUsd);
  let state = SEVERITY.OK;
  if (projected > budgetUsd) state = SEVERITY.BLOCK;
  else if (ratio >= warnRatio) state = SEVERITY.WARN;
  return { state, ratio: round6(ratio), remainingUsd, budgetSet: true };
}

// --- Quota (request-count) ----------------------------------------------
export function checkQuota({ used = 0, limit = 0, warnRatio = 0.8 } = {}) {
  if (!limit || limit <= 0) return { state: SEVERITY.OK, remaining: Infinity, ratio: 0, limitSet: false };
  const ratio = clampRatio(used / limit);
  let state = SEVERITY.OK;
  if (used >= limit) state = SEVERITY.BLOCK;
  else if (ratio >= warnRatio) state = SEVERITY.WARN;
  return { state, remaining: Math.max(0, limit - used), ratio: round6(ratio), limitSet: true };
}

// --- Anomaly (spend spike) ----------------------------------------------
// "Why did my agent burn $4k overnight?" — flag when the latest value in a
// spend series sits sigma standard deviations above the trailing mean. Guards
// against small samples and zero-variance (all-equal) history.
export function detectAnomaly(series = [], { sigma = 3, minSamples = 7 } = {}) {
  const xs = (series || []).map(Number).filter((n) => Number.isFinite(n));
  if (xs.length < minSamples) {
    return { anomaly: false, reason: 'insufficient-history', samples: xs.length, z: 0 };
  }
  const latest = xs[xs.length - 1];
  const hist = xs.slice(0, -1);
  const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
  const variance = hist.reduce((a, b) => a + (b - mean) ** 2, 0) / hist.length;
  const std = Math.sqrt(variance);
  if (std === 0) {
    // Flat history: any strictly positive jump is anomalous; identical is not.
    return { anomaly: latest > mean, reason: 'flat-history-jump', mean: round6(mean), std: 0, latest: round6(latest), z: latest > mean ? Infinity : 0 };
  }
  const z = (latest - mean) / std;
  return { anomaly: z >= sigma, mean: round6(mean), std: round6(std), latest: round6(latest), z: round6(z), threshold: sigma };
}

// --- The gate ------------------------------------------------------------
// policy  = { budgetUsd, quotaRequests, killSwitch, warnRatio, blockOnAnomaly, anomalySigma }
// context = { spentUsd, usedRequests, estCostUsd, series }
// Returns { allow, severity, reasons[], budget, quota, anomaly }. A single
// BLOCK anywhere denies the call; WARNs pass but surface. Fail-safe default is
// to ALLOW when a dimension is unconfigured (never brick a customer on a value
// they never set) — except the kill-switch, which is an explicit deny.
export function decide(policy = {}, context = {}) {
  const warnRatio = typeof policy.warnRatio === 'number' ? policy.warnRatio : 0.8;
  const reasons = [];

  if (policy.killSwitch === true) {
    return {
      allow: false,
      severity: SEVERITY.BLOCK,
      reasons: ['kill-switch engaged'],
      budget: null, quota: null, anomaly: null,
    };
  }

  const budget = evaluateSpend({
    spentUsd: context.spentUsd || 0,
    budgetUsd: policy.budgetUsd || 0,
    estCostUsd: context.estCostUsd || 0,
    warnRatio,
  });
  const quota = checkQuota({ used: context.usedRequests || 0, limit: policy.quotaRequests || 0, warnRatio });
  const anomaly = detectAnomaly(context.series || [], { sigma: policy.anomalySigma || 3 });

  if (budget.state === SEVERITY.BLOCK) reasons.push(`budget exceeded: $${context.spentUsd} + est would pass $${policy.budgetUsd}`);
  if (quota.state === SEVERITY.BLOCK) reasons.push(`request quota exhausted: ${context.usedRequests}/${policy.quotaRequests}`);
  if (anomaly.anomaly && policy.blockOnAnomaly === true) reasons.push(`spend anomaly: latest ${anomaly.latest} at z=${anomaly.z}`);

  const warns = [];
  if (budget.state === SEVERITY.WARN) warns.push(`budget ${Math.round(budget.ratio * 100)}% used`);
  if (quota.state === SEVERITY.WARN) warns.push(`quota ${Math.round(quota.ratio * 100)}% used`);
  if (anomaly.anomaly && policy.blockOnAnomaly !== true) warns.push(`spend anomaly (advisory) z=${anomaly.z}`);

  let severity = SEVERITY.OK;
  if (reasons.length) severity = SEVERITY.BLOCK;
  else if (warns.length) { severity = SEVERITY.WARN; reasons.push(...warns); }

  return {
    allow: severity !== SEVERITY.BLOCK,
    severity,
    reasons,
    budget,
    quota,
    anomaly,
  };
}

export function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

export default { SEVERITY, evaluateSpend, checkQuota, detectAnomaly, decide, round6 };
