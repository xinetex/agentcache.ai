# AgentCache.ai

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Trust Center](https://img.shields.io/badge/Trust-Verified-green)](https://agentcache.ai/trust)

AgentCache provides a governed execution path for supported agent workflows through authenticated APIs and MCP. Catalogued actions are checked against policy and recorded for operator review; the current provider pilot is a fixed, aggregate-only JettyThunder storage summary. Caching and memory support the broader platform.

It does three practical things:
- Gives agents a governed execution path with policy checks, human approval gates, and reviewable run history.
- Stores reusable session and document memory for retrieval-backed workflows.
- Caches repeated LLM and tool requests so agents return faster and cost less.

## Product Surface

### 1. Governed Agent Execution
- Discover supported execution tools at `GET /api/execution/tools`
- Start and inspect workflow runs through `/api/execution/runs`
- Enforce policy checks before actions and use human gates for high-impact outcomes
- Connect MCP clients using an AgentCache API key; credentials remain in the client configuration and are not pooled by AgentCache

### 2. AgentCache Core
- Semantic cache for LLM calls
- Tool result cache
- Session memory
- Active invalidation / anti-cache

### 3. AgentCache Guardrails
- Message-level prompt-injection checks, including the stateful chat path
- Sensitive-field and common-token redaction in selected stored execution records
- Tool source and MCP-manifest scanning
- Policy enforcement for catalogued governed actions

These controls are explicit integration points. They do not automatically intercept arbitrary model-provider or MCP traffic, and detector results depend on configuration.

### 4. AgentCache Knowledge
- Documentation ingest
- Semantic search
- Persistent workspace memory
- Retrieval-ready context APIs

### Enterprise Packages
- CDN and streaming acceleration
- File acceleration and dedup workflows
- Ontology and compliance pilots

## Quick Start

### JavaScript / TypeScript
```bash
npm install agentcache-client
```

```ts
import { AgentCache } from 'agentcache-client';

const cache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY!,
  namespace: 'default',
});

const cached = await cache.get({
  provider: 'openai',
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Summarize AgentCache in one sentence.' }],
});

if (!cached.hit) {
  await cache.set(
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Summarize AgentCache in one sentence.' }],
    },
    'AgentCache is the control layer between LLM intent and repeatable execution.'
  );
}
```

### MCP Server
```bash
npm run mcp:dev
```

The MCP server exposes `agentcache_execution_tools`, `agentcache_execution_start`, `agentcache_execution_status`, and `agentcache_execution_evaluate`. Configure the server with an AgentCache API key you control. The initial execution catalog is intentionally focused on AgentCache governed workflows; external provider credentials and a shared tool wallet are not part of this release.

The operator console is available at `/execution.html`. It stores the supplied API key in browser session storage for the current tab, offers an explicit disconnect action, and only lists workflow records owned by the connected principal.

## Pricing Model

Baseline public plans are:
- Solo Pilot (Free): $0, up to 10K requests/month
- Swarm Fleet (Pro): $99/month, up to 1M requests/month
- Cognitive Cluster (Enterprise): $499/month, up to 10M requests/month

These request-volume plans are separate from the proposed Execution Drift Guard pilot: $1,500/month for 90 days, scoped to one agreed workflow and one initial provider adapter. The action cap, support cadence, and provider pass-through costs must be agreed in writing. Governed-action usage remains measurement-only; no per-action overage rate has been validated.

Add-ons:
- Guardrails
- Knowledge

## Verification

```bash
npm run test:verification
```

## Repo Notes

This repo contains multiple generations of SDKs, billing flows, and UI surfaces. The active product direction is being consolidated around:
- `agentcache-client` for JavaScript/TypeScript
- org-scoped portal APIs
- self-serve onboarding that provisions a real workspace
