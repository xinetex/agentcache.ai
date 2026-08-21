# @agentcache/engine

Provider-neutral caching + savings engine for AI agents. Wrap any LLM call and it:

1. **Exact-match cache** — identical request → stored completion, the whole model call is avoided.
2. **Prompt-prefix cache** — shared stable prefix → a breakpoint you hand to your provider's prompt cache (billed at the cache-read rate).
3. **Live savings ledger** — dollars saved, by layer and by model, net of your plan cost.

It is not tied to any provider. You supply the function that calls your model; the engine wraps it. OpenAI, Anthropic, Gemini, local — all go through the same seam.

## Why it exists

Agentic loops resend a large, stable prefix on every step and frequently repeat identical calls. The cost is real and measurable — and *measurable* is the point: the engine turns cache hits into a verifiable dollar figure, which is both the proof it works and the basis for value-based pricing.

## Install / use

```js
import { AgentCache, MemoryStore } from '@agentcache/engine';

const ac = new AgentCache({
  store: new MemoryStore(),   // swap for RedisStore(client) in production
  org: 'acme',
  namespace: 'ci-agents',
  planCostUsd: 99,            // what you pay AgentCache — used for net/ROI
});

// Your real model call — the ONLY provider-specific code.
async function callOpenAI(req) {
  const r = await openai.chat.completions.create({ model: req.model, messages: req.messages });
  return {
    content: r.choices[0].message.content,
    usage: { inputTokens: r.usage.prompt_tokens, outputTokens: r.usage.completion_tokens },
  };
}

const out = await ac.complete(
  { model: 'gpt-5.2', messages, sessionId: 'run-42' },
  callOpenAI,
);
// out => { value, cached, layer: 'exact'|'prefix'|'miss', savedUsd, breakpointIndex, ... }

console.log(ac.savings());
// => { requests, hits, hitRate, grossSavedUsd, netSavedUsd, roi, byLayer, byModel }
```

On a `layer: 'prefix'` result, pass `out.breakpointIndex` to your provider's cache-control (e.g. Anthropic `cache_control` on that message) to realize the cache-read discount.

## Production store

```js
import { Redis } from '@upstash/redis';
import { AgentCache, RedisStore } from '@agentcache/engine';

const ac = new AgentCache({ store: new RedisStore(Redis.fromEnv()), org, namespace });
```

`RedisStore` adapts any Upstash-style client (`get`/`set`/`del`) — the module never imports Redis itself, so the engine stays dependency-free.

## Tenant isolation

Every key is prefixed `org:namespace:*` — the same isolation primitive as the HTTP API. Two orgs sharing a store never see each other's cache (covered by tests).

## Invalidation

```js
await ac.invalidateSession('run-42'); // e.g. on a git branch/PR webhook
```

## Prices

Model prices are current as of 2026-08-17 (Claude cache-read confirmed 0.1× input). They are **operator-configurable** — pass `prices` to the constructor or call `setPrices()` to sync your contracted rates. Unknown-model full-call hits are valued at **$0**, never guessed — the ledger never overstates.

## Test & demo

```bash
node test/engine.test.mjs          # 6 passing — exact/prefix/isolation/invalidation/savings
node examples/agent-loop-demo.mjs  # simulated month: ~15k requests, 30 real calls, ~$1.6k saved
```

## Layout

```
src/engine.js         AgentCache — the engine
src/store.js          MemoryStore + RedisStore
src/prefix-cache.js   pure prefix-reuse logic (unit-tested separately)
src/savings.js        price table + dollars-saved math (unit-tested separately)
src/index.js          public exports
```

MIT.
