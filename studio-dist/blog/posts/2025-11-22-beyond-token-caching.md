# Beyond Token Caching: The Rise of Agentic Plan Caching

*By AgentCache Team | November 22, 2025*

The conversation around AI efficiency is shifting. For the past year, "caching" meant one thing: **KV Cache** (Key-Value Cache) for text tokens. But as we move into late 2025, a new paradigm is emerging that validates everything we've been building at AgentCache.ai.

It's called **Agentic Plan Caching**, and it's about to make your agents significantly faster and cheaper.

## The Problem with "Just" Token Caching

Standard caching (like semantic caching or KV caching) works great for *static* knowledge. If a user asks "What is the capital of France?", you can cache the answer "Paris".

But agents aren't static. They **reason**, **plan**, and **execute tools**.
- **Reasoning:** "To answer this, I need to search for X, then filter by Y..."
- **Tool Execution:** Calling an API, parsing the JSON, handling errors.

If you only cache the final text output, you're throwing away the most expensive part of the compute: the **plan**.

## New Research: ToolCacheAgent & Plan Caching

Recent preprints from OpenReview and arXiv have highlighted this exact bottleneck.

### 1. ToolCacheAgent: Caching Execution, Not Just Text
Researchers have introduced frameworks like "ToolCacheAgent" that automatically generate caching plans for tool calls. Instead of re-executing a search or an API call every time, the agent learns which *intermediate steps* can be cached.
- **Result:** Up to **1.69x latency speed-up**.

### 2. Structured Plan Caching
Even more critical is the move to cache **structured plans**. New research (arXiv:2506.14852) demonstrates that caching the abstract *reasoning steps* of an agent—rather than just the raw tokens—can cut serving costs by **~46%**.

This allows an agent to reuse a "reasoning template" across semantically similar tasks, even if the specific details differ.

## How AgentCache Implements This

This research validates our core architecture. AgentCache isn't just a Redis wrapper for text; it's a **Cognitive Memory OS**.

- **Reasoning Cache (L2):** We cache the *reasoning tokens* (the "thought process") separately from the final answer. This aligns perfectly with the "Plan Caching" research.
- **Tool Output Caching:** Our architecture supports caching the results of tool executions, preventing redundant API calls.

## The Future is Stateful

We are moving from "stateless" LLM calls to "stateful" Agentic processes. The infrastructure that wins won't just be the one that serves tokens the fastest—it will be the one that intelligently manages the **execution state** of complex agents.

*Ready to upgrade your agent's memory? [Get started with AgentCache today](/).*
