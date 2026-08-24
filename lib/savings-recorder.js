// lib/savings-recorder.js
//
// AgentCache — Savings Recorder (Move 1: instrument the hit path).
//
// lib/savings.js turns a hit EVENT into dollars. This module is the missing
// wire: it captures, per hit, the three facts the Savings Engine needs but
// recordUsage() never persisted — model, layer, and saved tokens — and appends
// them to an immutable ledger (`savings_events`). The daily aggregate is still
// updated for the old dashboards, but the ledger is what makes "net dollars
// saved" auditable per model and per layer.
//
// Design rules:
//   1. `savingsFromHit` is PURE (no I/O) so it is unit-tested to the cent.
//   2. `recordHit` is a THIN persistence wrapper with dependencies INJECTED
//      (sql, recordUsage) — testable with fakes, and it FAILS OPEN. Telemetry
//      must never break the cache path: a ledger write that throws is swallowed
//      and logged, exactly like the existing recordUsage().
//   3. Unknown model → savedUsd 0 (never overstate). The hit is still recorded
//      with valued:false so hit-rate stays honest and can be re-priced later.

import { dollarsSaved, round2 } from './savings.js';

const LAYERS = new Set(['exact', 'semantic', 'prefix', 'reasoning']);

// Tokens whose cost the hit avoided. Exact/semantic avoid the whole call
// (in+out). Prefix re-bills the shared front at the cache-read rate, so the
// tokens that drove the saving are the prefix tokens. Reasoning re-uses prior
// state in place of regenerated tokens (carried in as inputTokens).
export function savedTokensFor(event) {
  switch (event.layer) {
    case 'exact':
    case 'semantic':
      return (event.inputTokens || 0) + (event.outputTokens || 0);
    case 'prefix':
      return event.prefixTokens || 0;
    case 'reasoning':
      return event.inputTokens || 0;
    default:
      return 0;
  }
}

// PURE. Normalize a raw hit into the ledger row shape + valued money figure.
export function savingsFromHit(event = {}) {
  const layer = LAYERS.has(event.layer) ? event.layer : 'exact';
  const model = typeof event.model === 'string' && event.model ? event.model : 'unknown';
  const norm = { ...event, layer, model };
  // Reasoning re-uses stored state; value it like an avoided input-side call.
  const priceEvent = layer === 'reasoning' ? { ...norm, layer: 'exact', outputTokens: 0 } : norm;
  const savedUsd = round2(dollarsSaved(priceEvent));
  const savedTokens = savedTokensFor(norm);
  return {
    layer,
    model,
    savedTokens,
    savedUsd,
    valued: savedUsd > 0, // false = known hit we could not price (unknown model / no tokens)
  };
}

// THIN. Append one hit to the ledger and roll it into the daily aggregate.
// deps = { sql, recordUsage }.  payload = { organizationId, namespace, event,
// sessionId?, agentId? }.  Never throws.
export async function recordHit(deps, payload) {
  const { sql, recordUsage } = deps || {};
  const { organizationId, namespace, event } = payload || {};
  try {
    if (!organizationId || !namespace || !event) return null;
    const s = savingsFromHit(event);

    // 1) Immutable ledger row (source of truth for the Savings Engine).
    if (typeof sql === 'function') {
      await sql`
        INSERT INTO savings_events
          (organization_id, namespace, ts, layer, model, saved_tokens, saved_usd, session_id, agent_id)
        VALUES
          (${organizationId}, ${namespace}, NOW(), ${s.layer}, ${s.model},
           ${s.savedTokens}, ${s.savedUsd},
           ${payload.sessionId || null}, ${payload.agentId || null})
      `;
    }

    // 2) Keep the legacy daily aggregate correct for existing dashboards.
    if (typeof recordUsage === 'function') {
      await recordUsage(organizationId, namespace, {
        requests: 1,
        hits: 1,
        misses: 0,
        tokens: s.savedTokens,
        costSaved: s.savedUsd,
      });
    }
    return s;
  } catch (err) {
    // Fail open — telemetry must never break the cache path.
    console.error('recordHit failed (non-fatal):', err && err.message ? err.message : err);
    return null;
  }
}

// Convenience: pull model + token counts off request headers without coupling
// the handlers to a header spec. Missing values degrade to an unpriced hit.
export function hitEventFromHeaders(headers, layer, extra = {}) {
  const get = (k) => (typeof headers.get === 'function' ? headers.get(k) : headers[k]);
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
  return {
    layer,
    model: get('X-Model') || get('x-model') || 'unknown',
    inputTokens: num(get('X-Input-Tokens') || get('x-input-tokens')),
    outputTokens: num(get('X-Output-Tokens') || get('x-output-tokens')),
    prefixTokens: num(get('X-Prefix-Tokens') || get('x-prefix-tokens')),
    ...extra,
  };
}

export default { savingsFromHit, savedTokensFor, recordHit, hitEventFromHeaders };
