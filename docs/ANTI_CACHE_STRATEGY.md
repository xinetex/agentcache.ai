# The "Anti-Cache": Forgetting is as Important as Remembering

## The Concept
You asked: **"What about our anti-cache?"**
In a "Memory OS", the **Anti-Cache** is the **Garbage Collector**.

If an agent remembers *everything*, it becomes:
1.  **Biased:** Stuck in old habits.
2.  **Confused:** Overloaded with irrelevant details.
3.  **Stale:** Acting on outdated facts.

## The Anti-Cache Features

### 1. "Flash Neuralyzer" (Context Pruning)
*   **Goal:** Remove specific bad memories or "hallucinations" from L3.
*   **Mechanism:** `DELETE /api/agent/memory?id=...`
*   **Use Case:** The agent learned a wrong fact. You need to surgically remove it so it doesn't repeat the mistake.

### 2. "Freshness Injection" (Bypass)
*   **Goal:** Force the agent to ignore L2/L3 and look at *new* data.
*   **Mechanism:** `POST /api/agent/chat` with `freshness: "absolute"`.
*   **Action:** The `ContextManager` ignores the Vector DB and only uses the System Prompt + User Input.

### 3. "Episodic Decay" (Automatic Forgetting)
*   **Goal:** Like humans, agents should forget trivial details over time.
*   **Mechanism:** A background job that "fades" L3 vector scores over time unless they are "reinforced" (accessed again).

## Strategic Value
**"Infinite Memory"** is the engine. **"Anti-Cache"** is the steering wheel.
Without Anti-Cache, your agent drives off a cliff of its own hallucinations.
