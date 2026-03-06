# AgentCache.ai

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Trust Center](https://img.shields.io/badge/Trust-Verified-green)](https://agentcache.ai/trust)

AgentCache is AI middleware for caching, memory, and policy-safe execution.

It does three practical things:
- Caches repeated LLM and tool requests so agents return faster and cost less.
- Stores reusable session and document memory for retrieval-backed workflows.
- Adds guardrails around agent inputs, outputs, and third-party tools.

## Product Surface

### 1. AgentCache Core
- Semantic cache for LLM calls
- Tool result cache
- Session memory
- Active invalidation / anti-cache

### 2. AgentCache Guardrails
- PII and secret redaction
- Prompt and topic validation
- Tool safety scanning
- Policy-aware workflow enforcement

### 3. AgentCache Knowledge
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

## Pricing Model

Public packaging is now:
- Free: 10K requests/month
- Pro: $99/month, 1M requests/month
- Enterprise: $299/month, 10M requests/month

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
