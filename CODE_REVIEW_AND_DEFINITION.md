# AgentCache — Code Review & Project Definition

*Prepared July 29, 2026*

This document does two things you asked for: a **code review** of the caching core, and a **definition** — what this project actually is, whether the "digital silly putty" idea holds up, and where caching for agents is heading.

---

## 1. What the project is right now

The README describes a clean three-part product: **Core** (cache), **Guardrails** (PII/policy), **Knowledge** (ingest/search). That framing is good and marketable.

The repo, however, is much larger than that framing. Underneath the caching core sit a dozen half-built directions: a Roku app, a video transcoder, Solana Pay, Telegram bots, 3D force-graph "cognitive universe" visualizations, several generations of dashboards and landing pages (`index-v2`, `index-v3`, `index-premium`, `index-legacy`, `_archive/`), two SDKs (JS and Python), and multiple parallel auth systems. The actual caching engine — the thing the product name promises — is maybe 5% of the files and is buried.

**The single most important takeaway:** the *idea* is coherent and current. The *codebase* has lost its center of gravity. Before more features, this project needs a definition it can delete against.

---

## 2. Code review — the caching core

I focused on the real service code (`api/cache/*`, `lib/api-key-middleware.js`, `sdk-python/`), not the marketing surface.

### Critical

**No authentication on cache invalidation.** `api/cache/invalidate.ts` accepts `pattern`, `namespace`, and `olderThan` and flushes matching entries — with no API-key check at all. Every other endpoint validates a key; this one doesn't. Anyone who knows the URL can wipe any tenant's cache by pattern. This is the highest-priority fix.

**Possible cross-tenant leak in semantic cache.** In `api/cache/semantic.js`, `searchSemanticCache()` queries the vector index with `topK: 1` but **no namespace or organization filter**. `get.ts`/`set.ts` carefully prefix every key with `org_slug:namespace:` for isolation, but the semantic path throws that isolation away — one org's query can match and return another org's cached response. Namespace must be part of the vector query filter, not just the metadata.

**Invalid + unsafe CORS.** `invalidate.ts` sets `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`. Browsers reject that combination, and where it is honored it's a security hole. Pick a real allow-list or drop credentials.

### High

**API and SDK contracts disagree.** The README's JS example checks `if (!cached.hit)`. But `get.ts` returns **HTTP 404 with an error body** on a miss and `{ cached: true }` on a hit — there is no `hit` field anywhere. A developer following the README's own quick-start would get an exception on the first miss. A cache "miss" is a normal, expected outcome and should be a `200` with `{ hit: false }`, not a `404`.

**Committed AI scratch-text in production source.** `api/cache/semantic.js` contains leftover assistant commentary in the actual file — lines like *"Wait, I should probably do this in two chunks... I'll use multi_replace_file_content to be safe."* This shipped into the source. It's harmless at runtime but it's a strong signal that automated edits are landing without review. Worth a grep across the repo for similar residue.

**Four overlapping auth paths.** `lib/api-key-middleware.js`, `lib/validate-api-key.js`, `lib/auth-unified.js`, and `api/_auth.js` all exist; `get.ts` uses one, `semantic.js` uses another. Fragmented auth is how the invalidate-endpoint gap above happens in the first place. Consolidate to one middleware and route everything through it.

### Medium

**Key-format messaging is inconsistent.** The code accepts any key starting with `ac_`, but error messages promise `ac_live_*`/`ac_test_*` and the README uses plain `ac_`. Decide on one scheme and validate it.

**Module-level Redis client with non-null assertions.** `new Redis({ url: process.env.UPSTASH_...! })` runs at import time; if the env var is missing in a given environment, the function crashes cold rather than returning a clean 500. Lazily initialize and fail gracefully.

**`set` records a request but never distinguishes fill vs. overwrite**, so hit-rate analytics will be slightly off. Minor, but it's the number the whole value prop rests on.

### Repo hygiene (not bugs, but they're taxing the project)

The working tree is dirty (core files like `server.js`, `src/App.jsx`, `README.md` modified but uncommitted; ~20 untracked files including `api/auth.js` and `api/tools.js`). A 132 KB `studio.html.bak`, a `grok session 5.27/` folder, and many one-off root-level `.mjs` scripts are checked in. `package.json` carries three.js, react-force-graph, Solana, Telegraf, LangChain, and MemVid — a very large dependency surface for what is fundamentally a cache proxy. Each of these is a small thing; together they make the repo hard to reason about and hard to onboard to.

*Good things worth keeping:* the `org:namespace:key` prefixing scheme is the right isolation primitive; `.env*` is properly gitignored; the SECURITY.md and TrapDoor injection-defense notes show real security awareness; and the Python `ReasoningCache` (working/episodic/procedural memory) is genuinely interesting — more on that below.

---

## 3. The definition — and yes, the silly putty makes sense

You said you might be wrong about the "digital silly putty" idea. You're not wrong — but the metaphor points at something more specific than "cache," and naming that precisely is exactly the definition this project is missing.

A traditional **cache** is rigid: you store an exact result under an exact key and hand back a perfect copy on a repeat. Read-mostly, immutable, correctness = exact match. That's `get.ts`/`set.ts`.

Silly putty is the opposite of rigid. It's a **malleable shared medium**: agents press into it, it holds an impression for a while, it can be reshaped, and it can lift a copy of something and transfer it elsewhere. That's not a key-value cache — that's **shared, mutable agent memory / working state**. And the striking thing is your repo already contains this instinct: `sdk-python/agentcache/strategies/reasoning.py` implements working memory, episodic memory, and procedural memory with decay and a gating mechanism. That file *is* the silly putty. The Redis KV store is the rigid cache. They're two different products living in one repo.

So the honest definition is a layered one, and it happens to line up with where the field actually is in 2026:

- **Exact-match cache** — deterministic key, perfect replay. (Your `get`/`set`.) Cheapest, safest, ~90% cost cut on true repeats.
- **Prefix / prompt cache** — reuse the unchanging front of a long prompt. This is *the* highest-leverage, lowest-risk win for agents in 2026, because agentic loops resend the same 20K-token system prompt on every step. Your product doesn't clearly do this yet, and it's arguably the most valuable layer to own.
- **Semantic cache** — fuzzy match by embedding similarity, hit rates 30–70%. (Your `semantic.js`.) Higher hit rate, but you trade exactness — hence the namespace-leak risk above matters a lot.
- **Reasoning / state cache — the silly putty** — cache the *intermediate steps and working state*, not just the final answer, and let agents reshape it. This is the frontier (see the 2026 SemanticALLI and TVCACHE papers), and it's what your `reasoning.py` is reaching for.

Read top to bottom, that's not four products — it's one **spectrum from rigid to malleable memory for agents.** "AgentCache" can credibly be defined as: *the memory and state layer for agents — from exact replay to malleable working memory — with tenant isolation and guardrails built in.* The silly-putty end is your differentiator; the exact-match end is your reliable revenue.

---

## 4. Recommendations, in order

1. **Fix the three security items this week:** add auth to `invalidate.ts`, add a namespace filter to the semantic vector query, and fix the CORS combination. These are small changes with outsized risk.
2. **Make the API match the README** — return `200 { hit: false }` on a miss and expose a real `hit` field. Your own quick-start currently throws.
3. **Pick one definition and delete against it.** Decide whether v1 is "cache proxy" or "agent memory layer," then archive the Roku/transcoder/Solana/Telegram/visualization directions out of the main repo. They can live elsewhere; they shouldn't dilute the core.
4. **Consolidate to one auth middleware** and grep out the committed AI scratch-text.
5. **Then invest in the two layers that are both valuable and on-trend:** prefix/prompt caching (best near-term ROI) and the reasoning/state cache (your long-term moat and the real "silly putty").

You set this project up so an agent could help you understand and shape it — that instinct was right, and the silly-putty framing is a better north star than the current README. The work now is subtraction, not addition.

---

*Sources for the caching-landscape section: [Prompt Caching in 2026 (DigitalApplied)](https://www.digitalapplied.com/blog/prompt-caching-2026-cut-llm-costs-engineering-guide), [Semantic Cache for LLM Inference (Spheron)](https://www.spheron.network/blog/semantic-cache-llm-inference-gpu-cloud/), [Don't Break the Cache — prompt caching for long-horizon agents (arXiv)](https://arxiv.org/pdf/2601.06007), [SemanticALLI — caching reasoning in agentic systems (arXiv)](https://arxiv.org/pdf/2601.16286).*
