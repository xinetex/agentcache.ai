# Implementation Plan: Virtual Context Memory (The "HPC" Layer for Agents)

# Goal Description
We are building a **"Virtual Memory Controller"** for AI Agents. Just as HPC systems move data between fast RAM and slow Disk to optimize performance, we will move Agent Context between **Hot** (Active Window), **Warm** (Redis Cache), and **Cold** (Vector Storage) tiers.

**No new hardware is required.** We will use **Upstash** (Serverless Redis & Vector) as our infrastructure backbone.

## User Review Required
> [!IMPORTANT]
> **Architecture Change:** This introduces a "Stateful" component to AgentCache. Previously, we were a stateless pass-through. Now, we will actively manage conversation state for the user.

## Proposed Changes

### Core Architecture: The 3-Tier Context System

We will implement a new `ContextManager` class in the SDK/API that handles data movement.

| Tier | HPC Analogy | Agent Implementation | Technology | Latency | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **L1 (Hot)** | L1/L2 Cache | **Active Context Window** | In-Memory (Request Scope) | < 1ms | $$$ (Token Cost) |
| **L2 (Warm)** | DRAM | **Recent Conversation** | Upstash Redis | < 50ms | $$ |
| **L3 (Cold)** | NVM / Disk | **Long-term Knowledge** | Upstash Vector | ~100ms | $ |

### 1. Infrastructure Setup (`/src/infrastructure`)
#### [NEW] `ContextManager.ts`
*   **Responsibility:** The "Memory Controller". Decides what stays in L1 and what moves to L2/L3.
*   **Logic:**
    *   On Request: Fetch relevant context from L2/L3 based on query.
    *   On Response: Save new interaction to L1 -> Async push to L2.
    *   Background: "Eviction Policy" moves old L2 data to L3 (Vectorize & Archive).

### 2. Data Layer (`/src/lib`)
#### [MODIFY] `redis.ts`
*   Add support for "Session Lists" (storing conversation history as lists).

#### [NEW] `vector.ts`
*   Implement `Upstash Vector` client.
*   Methods: `upsertMemory(text)`, `queryMemory(text)`.

### 3. The "Prefetcher" (Predictive Loading)
#### [NEW] `Prefetcher.ts`
*   **Concept:** Before asking the big model (GPT-4), ask a tiny model (GPT-4o-mini): *"What memories does the user need for this query?"*
*   **Action:** Retrieve those specific chunks from L3 and inject them into L1.

## Verification Plan

### Automated Tests
*   **Unit Tests:** Verify `ContextManager` correctly promotes/demotes data between tiers.
*   **Integration Tests:** Run a simulated conversation:
    1.  Message 1 (Stored in L1/L2).
    2.  ... 50 messages later ...
    3.  Message 51 (References Message 1).
    4.  **Verify:** System correctly retrieves Message 1 from L3 (Vector) and provides it to the model.

### Manual Verification
*   We will build a simple CLI chat demo that shows "Cache Hits" and "Memory Retrievals" in real-time logs.
