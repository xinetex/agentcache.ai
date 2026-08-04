# Plan-and-Verify Orchestrator Implementation Plan

This document outlines the architecture for a rigorous orchestrator that delegates tasks to a swarm and enforces a strict, LLM-driven verification checklist before accepting results. 

## Goal
Build an orchestrator that can take a broad goal (e.g., "Research 100 EV companies") and a strict checklist, farm out the sub-tasks to worker agents, and ruthlessly verify their outputs, rejecting and retrying any that fail the checklist.

## Proposed Changes

### [NEW] `src/services/PlanAndVerifyOrchestrator.ts`
We will create a new service that encapsulates the "Plan -> Dispatch -> Verify -> Loop" pattern.

#### Key Methods:
1. **`executeCampaign(goal: string, dataset: any[], checklist: string[])`**
   - The main entry point. E.g. dataset = 100 EV companies.
   - Iterates through the dataset (or dispatches in parallel).
   
2. **`dispatchToSwarm(item: any, goal: string)`**
   - Spawns or assigns a worker agent from the `AgentRegistry` (e.g., a "Research Agent") to process a single item.
   - Collects the output.

3. **`verifyResult(output: string, checklist: string[])`**
   - Calls the `ModelRouter` (using a high-reasoning tier like `capable` or `master`) with the output and the exact checklist.
   - The LLM will be prompted to act as a strict Verifier. It must output a JSON object: `{ passed: boolean, failures: string[], feedback: string }`.

4. **`processItem(item: any, goal: string, checklist: string[], maxRetries = 3)`**
   - A `while` loop that dispatches the task to the swarm, runs `verifyResult`, and if `passed` is false, it appends the `feedback` to the worker's next prompt and retries.
   - If it exceeds `maxRetries`, it flags the item for human review.

## Integration & Use Case
We can expose this orchestrator via an API endpoint (e.g., `/api/orchestrator/campaign`) or run it as a background job via Inngest, allowing massive scale research tasks (like 100 EV companies) to run reliably.

## Open Questions
> [!IMPORTANT]
> 1. **Data Source:** For the "research 100 EV-market companies" use case, where is the initial list of companies coming from? Should the Orchestrator itself plan/generate the list of 100 companies first, or do we assume the user provides the list of names?
> 2. **Worker Agents:** Should the orchestrator use generic agents (like Claude 3.5 Sonnet) for the research, or should it use specific predefined agents from the `AgentRegistry` that have specialized web-browsing tools?

## Verification Plan
1. **Unit Test:** Create a script to run a mock campaign with 2 companies and a simple checklist. 
2. **Checklist Enforcement:** Intentionally provide a flawed response and verify that the `verifyResult` method catches it and triggers a retry.
