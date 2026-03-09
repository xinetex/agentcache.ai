# Lemma Intelligence Protocol (Goal Decomposition)

Lemma is the cognitive backbone of AgentCache. It enables complex goals to be decomposed into executable sub-tasks, matched against cached patterns, and synthesized into a final cognitive result.

## Core Concepts

- **Goal**: The high-level intent (e.g., "Analyze the financial impact of the merger").
- **Decomposition**: Breaking the goal into N independent or sequential "Lemmas".
- **Synthesis**: Re-assembling the outputs of each sub-task into a cohesive response.

## API Execution

```bash
POST https://agentcache.ai/api/lemma/execute
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "goal": "Explain quantum computing to a 5-year-old and then to a PhD student.",
  "engine": "inception",
  "strategies": ["speed", "depth"]
}
```

## Benefits
1. **Stability**: Smaller sub-tasks are less prone to model hallucination.
2. **Cache Efficiency**: Sub-tasks (Lemmas) are often repeated across different high-level goals.
3. **Parallelism**: Multiple models can execute different Lemmas simultaneously via the LLM Registry.

## Implementation Details
The service leverages the `LemmaService.ts` internally, using Dependency Injection to resolve the optimal LLM provider for each stage (Decomposition vs. Execution).
