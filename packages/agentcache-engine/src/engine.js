// src/engine.js — the AgentCache engine.
//
// Provider-neutral. You give it a function that actually calls your LLM; it
// wraps that call with:
//   1. exact-match cache  — identical request → stored completion, whole call avoided
//   2. prompt-prefix cache — shared stable prefix → breakpoint + cache-read savings
//   3. a live savings ledger — dollars saved, by layer and by model, net of plan
//
// Tenant isolation is the same org:namespace:* primitive as the HTTP API.
// Nothing here is tied to a provider — OpenAI, Anthropic, Gemini, local, all
// go through the same `callLLM` seam.

import { createHash } from 'node:crypto';
import { computePrefixReuse, estimateTokens, messageText } from './prefix-cache.js';
import { dollarsSaved, round2, setPrices, DEFAULT_PRICES } from './savings.js';

const DAY = 60 * 60 * 24;

function stableStringify(obj) {
  // Deterministic JSON for cache keys (sorted keys).
  return JSON.stringify(obj, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((o, k) => ((o[k] = v[k]), o), {})
      : v,
  );
}

export class AgentCache {
  constructor(opts = {}) {
    this.store = opts.store; // required: MemoryStore | RedisStore | custom
    if (!this.store) throw new Error('AgentCache requires a store');
    this.org = opts.org || 'org';
    this.namespace = opts.namespace || 'default';
    this.exactTtl = opts.exactTtlSeconds ?? DAY;
    this.prefixTtl = opts.prefixTtlSeconds ?? DAY;
    this.planCostUsd = opts.planCostUsd ?? 0;
    this.minPrefixMessages = opts.minPrefixMessages ?? 1;
    if (opts.prices) setPrices(opts.prices);

    // Running ledger — cheap totals, no per-event array to grow unbounded.
    this._ledger = {
      requests: 0,
      hits: 0,
      grossSavedUsd: 0,
      byLayer: {},
      byModel: {},
    };
  }

  _exactKey(model, messages, params) {
    const h = createHash('sha256')
      .update(stableStringify({ model, messages, params: params || null }))
      .digest('hex')
      .slice(0, 32);
    return `${this.org}:${this.namespace}:exact:${h}`;
  }
  _prefixKey(sessionId) {
    return `${this.org}:${this.namespace}:prefix:${sessionId}`;
  }

  _record(layer, model, savedUsd, isHit) {
    this._ledger.requests += 1;
    if (isHit) this._ledger.hits += 1;
    this._ledger.grossSavedUsd = round2(this._ledger.grossSavedUsd + savedUsd);
    this._ledger.byLayer[layer] = round2((this._ledger.byLayer[layer] || 0) + savedUsd);
    this._ledger.byModel[model] = round2((this._ledger.byModel[model] || 0) + savedUsd);
  }

  // The core method. `request` = { model, messages, sessionId?, params? }.
  // `callLLM` = async (request) => { content, usage?: { inputTokens, outputTokens } }.
  async complete(request, callLLM) {
    const { model, messages } = request;
    if (!model || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('complete() requires { model, messages[] }');
    }
    const sessionId = request.sessionId || 'default';
    const exactKey = this._exactKey(model, messages, request.params);

    // 1) Exact-match hit — the whole call is avoided.
    const cached = await this.store.get(exactKey);
    if (cached) {
      const savedUsd = dollarsSaved({
        layer: 'exact',
        model,
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
      });
      this._record('exact', model, savedUsd, true);
      return {
        value: cached.value,
        cached: true,
        layer: 'exact',
        savedUsd,
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
      };
    }

    // 2) Miss — analyze prefix reuse against this session's last turn.
    const prevPrefix = await this.store.get(this._prefixKey(sessionId));
    const reuse = computePrefixReuse(prevPrefix, messages, { minPrefixMessages: this.minPrefixMessages });

    // Call the real model.
    const resp = await callLLM(request);
    if (!resp || typeof resp.content === 'undefined') {
      throw new Error('callLLM must resolve to { content, usage? }');
    }
    const inputTokens =
      resp.usage?.inputTokens ?? messages.reduce((s, m) => s + estimateTokens(messageText(m)), 0);
    const outputTokens = resp.usage?.outputTokens ?? estimateTokens(resp.content);

    // Prefix savings are realized on the provider side via the breakpoint; we
    // value and record them so the ledger reflects the cache-read discount.
    let layer = 'miss';
    let savedUsd = 0;
    if (reuse.hit) {
      layer = 'prefix';
      savedUsd = dollarsSaved({ layer: 'prefix', model, prefixTokens: reuse.reusableTokensApprox });
    }

    // Persist completion (for future exact hits) + session fingerprint.
    await this.store.set(exactKey, { value: resp.content, inputTokens, outputTokens }, this.exactTtl);
    await this.store.set(this._prefixKey(sessionId), reuse.curHashes, this.prefixTtl);

    this._record(layer, model, savedUsd, reuse.hit);

    return {
      value: resp.content,
      cached: false,
      layer, // 'prefix' when a warm prefix was reused, else 'miss'
      savedUsd,
      breakpointIndex: reuse.breakpointIndex, // hand to your provider's cache_control
      reusableMessages: reuse.reusableMessages,
      inputTokens,
      outputTokens,
    };
  }

  // Invalidate one session's prefix (e.g. on an Origin branch/PR webhook).
  async invalidateSession(sessionId) {
    await this.store.del(this._prefixKey(sessionId));
  }

  // The number the business rests on.
  savings() {
    const gross = this._ledger.grossSavedUsd;
    const plan = this.planCostUsd;
    return {
      requests: this._ledger.requests,
      hits: this._ledger.hits,
      hitRate: this._ledger.requests ? round2(this._ledger.hits / this._ledger.requests) : 0,
      grossSavedUsd: gross,
      planCostUsd: plan,
      netSavedUsd: round2(gross - plan),
      roi: plan > 0 ? round2(gross / plan) : null,
      byLayer: { ...this._ledger.byLayer },
      byModel: { ...this._ledger.byModel },
    };
  }
}

export { DEFAULT_PRICES };
