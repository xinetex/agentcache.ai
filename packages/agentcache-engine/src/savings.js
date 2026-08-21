// lib/savings.js
//
// AgentCache — Savings Engine (pure logic).
//
// The whole business rests on ONE verifiable number: net dollars saved. A cache
// hit that doesn't translate into a dollar figure the customer can check is not
// a product — it's a claim. This module turns hit events into money, using
// current provider prices, and nets that against what the customer pays us.
//
//   gross saved  = Σ (value avoided by each hit)
//   net saved    = gross saved − customer's AgentCache plan cost
//   ROI          = gross saved / plan cost
//
// No Redis/HTTP here so it can be unit-tested and reused anywhere.

// --- Price table: USD per 1,000,000 tokens. -------------------------------
// Verified from provider pricing on 2026-08-17 (Claude platform docs;
// IntuitionLabs comparison). cacheRead = fraction of the INPUT price billed on
// a prompt-cache read. Claude's is confirmed 0.10 (a 90% discount). Others are
// set conservatively and are OPERATOR-CONFIGURABLE — call setPrices() to sync
// them to your contract's real rates before trusting the dollar figure.
export const DEFAULT_PRICES = {
  // Anthropic (cache read confirmed 0.1x input)
  'claude-opus-5':     { in: 5,    out: 25, cacheRead: 0.10 },
  'claude-opus-4.8':   { in: 5,    out: 25, cacheRead: 0.10 },
  'claude-sonnet-5':   { in: 2,    out: 10, cacheRead: 0.10 },
  'claude-sonnet-4.6': { in: 3,    out: 15, cacheRead: 0.10 },
  'claude-haiku-4.5':  { in: 1,    out: 5,  cacheRead: 0.10 },
  // OpenAI
  'gpt-5.2':           { in: 1.75, out: 14, cacheRead: 0.10 },
  // Google (cacheRead conservative default — confirm against your rate)
  'gemini-3.1-pro':    { in: 2,    out: 12, cacheRead: 0.25 },
  'gemini-3-flash':    { in: 0.5,  out: 3,  cacheRead: 0.25 },
  // xAI
  'grok-4.1-fast':     { in: 0.2,  out: 0.5, cacheRead: 0.25 },
};

const DEFAULT_CACHE_READ = 0.25; // conservative fallback for unknown models

let PRICES = { ...DEFAULT_PRICES };

// Operator config: merge in your real contracted rates. Unknown-model reads
// fall back to a conservative estimate so savings are never overstated.
export function setPrices(overrides) {
  PRICES = { ...PRICES, ...overrides };
}
export function getPrice(model) {
  return PRICES[model] || null;
}

const perToken = (perMTok) => perMTok / 1_000_000;

// Dollars saved by a single hit event.
//
// event = {
//   layer: 'exact' | 'semantic' | 'prefix',
//   model: string,
//   inputTokens?, outputTokens?,   // for exact/semantic (whole call avoided)
//   prefixTokens?,                 // for prefix (shared front billed at cache-read rate)
// }
export function dollarsSaved(event) {
  const price = PRICES[event.model];
  if (!price) {
    // Unknown model: we can still value a prefix hit with a fallback discount,
    // but we cannot value a full-call-avoided hit without prices — return 0
    // rather than guess (never overstate).
    return 0;
  }

  switch (event.layer) {
    case 'exact':
    case 'semantic': {
      // A stored/similar completion was served — the entire model call was avoided.
      const inTok = event.inputTokens || 0;
      const outTok = event.outputTokens || 0;
      return inTok * perToken(price.in) + outTok * perToken(price.out);
    }
    case 'prefix': {
      // The call still happens, but the shared prefix bills at the cache-read
      // rate instead of full input price. Saving = prefix × input × (1 - cacheRead).
      const pfx = event.prefixTokens || 0;
      const cr = typeof price.cacheRead === 'number' ? price.cacheRead : DEFAULT_CACHE_READ;
      return pfx * perToken(price.in) * (1 - cr);
    }
    default:
      return 0;
  }
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

// Aggregate a list of hit events into a savings summary, net of plan cost.
// opts.planCostUsd = what the customer pays AgentCache for the period.
export function summarize(events, opts = {}) {
  const planCostUsd = opts.planCostUsd || 0;
  const byLayer = {};
  const byModel = {};
  let grossSavedUsd = 0;
  let hits = 0;

  for (const e of events) {
    const saved = dollarsSaved(e);
    grossSavedUsd += saved;
    if (saved > 0) hits++;
    byLayer[e.layer] = round2((byLayer[e.layer] || 0) + saved);
    byModel[e.model] = round2((byModel[e.model] || 0) + saved);
  }

  grossSavedUsd = round2(grossSavedUsd);
  const netSavedUsd = round2(grossSavedUsd - planCostUsd);
  const roi = planCostUsd > 0 ? round2(grossSavedUsd / planCostUsd) : null;

  return {
    events: events.length,
    hits,
    grossSavedUsd,
    planCostUsd,
    netSavedUsd,
    roi, // e.g. 42.5 means $42.50 saved per $1 spent with AgentCache
    byLayer,
    byModel,
  };
}
