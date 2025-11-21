# Cognitive Memory Layer: From "Cache" to "Cortex"

## Evaluation of Research
The provided research is high-value. It moves AgentCache from a **Storage System** (L1/L2/L3) to a **Cognitive System**.
*   **Utility:** Critical for Enterprise AI. "Dumb" memory leads to hallucinations. "Smart" memory validates facts.
*   **Refactor Strategy:** We will introduce a `CognitiveEngine` that sits between the API and the `ContextManager`.

## Architecture: The "Cognitive Pipeline"

### 1. Memory Validator (The Gatekeeper)
Before saving *any* memory to L3, it must pass validation.
*   **Checks:**
    1.  **Source Verification:** Is this from a trusted user/agent?
    2.  **Hallucination Risk:** (Simulated for now) Does it look like a hallucination?
    3.  **Consistency:** Does it contradict existing facts?

### 2. Conflict Resolver (The Judge)
When retrieving memories, if two memories conflict (e.g., "My favorite color is Blue" vs "My favorite color is Red"), the Resolver decides.
*   **Strategy:** `Temporal Priority` (Newer > Older) + `Confidence Score`.

### 3. Verified Semantic Cache (The Gold Standard)
A special subset of L3 for "Verified Facts" that bypasses the decay algorithm.

## Implementation Plan (TypeScript)

### New Component: `src/infrastructure/CognitiveEngine.ts`
Will implement:
*   `validateMemory(content: string): Promise<ValidationResult>`
*   `resolveConflicts(memories: Message[]): Promise<Message[]>`

### Update: `ContextManager.ts`
*   **Write Path:** `saveInteraction` -> `CognitiveEngine.validate` -> `L3`
*   **Read Path:** `getContext` -> `L3` -> `CognitiveEngine.resolveConflicts` -> `Context`

## Roadmap
1.  **Scaffold `CognitiveEngine`:** Convert Python concepts to TypeScript.
2.  **Integrate into `ContextManager`:** Add the "Brain" to the "Body".
3.  **Push to GitHub:** Save the v2 platform.
