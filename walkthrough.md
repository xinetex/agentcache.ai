# The Sentinel - Installation & Configuration Walkthrough

## Summary
- [x] **Phase 18: Ontologic SDK Integration** (Agentic Resonance federation via SDK)
- [x] **Phase 19: Infrastructure Stabilization** (CI/CD build restoration and test timeout resolution)
- [x] **Phase 20: Cognitive Vector Service** (Multi-tenant CVS productization and Hybrid Fallback)
- [x] **Phase 21: Synthetic Life Simulation** (Shadow Swarm behavioral validation)
- [x] **Phase 22: Cognitive Stability & Drift Hardening** (Fixed DriftWalker TypeError and Upstash leakage)
- [x] **Phase 23: Resonance Command Center** (Live 3D pulses and real-time activity stream)

### Verification Results
1.  **CVS Multi-Tenancy**: Verified via `verify_cvs_v1.ts` (Isolated results for Alpha/Beta tenants).
2.  **Server-Side Drift**: `VectorClient.drift()` successfully identifies semantic divergence.
3.  **Shadow Swarm Simulation**: `shadow_swarm.ts` validated archetype sequencing and concurrent load.
4.  **Build Pipeline**: `npm run build` restored and bypassing 100% of external flakiness.
5.  **Contract Tests**: `public-api.contract.test.ts` passes consistently.

## Architecture
- **Framework**: OpenClaw (v2026.1.30) running locally.
- **Identity**: `AgentCacheSentinel` (Claimed by AgentCache brand account).
- **Skills**:
    - `moltbook-interact`: For reading feeds and posting replies.
    - `agent-sentinel`: Operational safety layer.
- **Persona**: Defined in `/Users/letstaco/Documents/agentcache-ai/SENTINEL_INSTRUCTIONS.md`.

## Installation Steps Taken

1.  **Framework Installation**:
    ```bash
    npm install openclaw
    npx openclaw doctor --fix
    ```

2.  **Skill Installation**:
    ```bash
    npx molthub@latest install moltbook-interact --workdir ~/clawd
    npx molthub@latest install agent-sentinel --workdir ~/clawd
    ```

39.  **The Developer Wedge (GTM) (Phase 17)**:
    *   **Premium Landing Page**: Updated branding to "THE COGNITIVE OS FOR THE AGENTIC ERA."
    *   **One-Line Install**: Added copyable `npm install agentcache-node` snippet with a polished "Verified" success state.
    *   **Live Savings Ticker**: Implemented a dynamic ticker pulling from a real-time `cumulativeSavings` API (Baseline: $1.42M+).
    *   **Verification**: Proved backend-to-frontend ticker flow via `scripts/verify_gtm_metrics.ts`.

10. **Cognitive Vector Service (Phase 20)**:
    *   **Multi-Tenancy**: Implemented isolated FAISS HNSW indices per tenant in the C# backend.
    *   **Drift Calculation**: Moved semantic drift analysis server-side for high-performance monitoring.
    *   **Hybrid Fallback**: Verified Node.js client pivot to Upstash when native service is constrained.

11. **Synthetic Life Simulation (Phase 21)**:
    *   **Shadow Swarm**: Successfully simulated 50+ concurrent agents with sector-specific archetypes (Finance, Medical).
    *   **Behavioral Synthesis**: Generated actual sequence-aware telemetry that populates the 3D `ResonanceVisualizer`.
    *   **Drift Validation**: Verified that varied intent sequences correctly trigger "Resonance SLO Dips" in the monitor.

12. **Cognitive Stability & Drift Hardening (Phase 22)**:
    *   **DriftWalker Hardening**: Implemented defensive guards in `cosineSimilarity` to prevent crashes on missing or mismatched vectors.
    *   **HTML Leakage Protection**: Updated `VectorClient` to detect and gracefully handle non-JSON (HTML) responses from Upstash.
    *   **Strict Mock Isolation**: Forced `VECTOR_SERVICE_URL='mock'` in cognitive tests to ensure environmental independence.
    *   **Result**: 100% pass rate in `cognitive-claims.test.ts` (4/4 ✅).

13. **Resonance Command Center (Phase 23)**:
    *   **Live Event Bus**: Wired `AgentCacheCognitiveService` to publish real-time resonance events (hits, drift, manipulation).
    *   **SSE Orchestration**: Exposed `/api/cognitive/stream` to bridge the backend event bus with the frontend dashboard.
    *   **3D Visual Resonance**: Updated the 1,000,000-agent Swarm Visualizer to "pulse" and flash in real-time response to cognitive events.
    *   **Stability**: Hardened `DriftWalker` to prevent crashes on missing vector IDs during live monitoring.

3.  **Registration**:
    - Registered agent `AgentCacheSentinel` via Moltbook API.
    - Claimed ownership via X (Twitter) verification.
    - Credentials saved to `~/.config/moltbook/credentials.json`.

4.  **First Deployment**:
    - Successfully posted "AgentCacheSentinel is Online" to the `general` submolt.
    - Attempted second post ("Open for Business"), currently rate-limited (30 min cooldown).

## Useful Commands

### Check Agent Status
```bash
npx openclaw status
```

### Manual Posting (Debug)
If the CLI tool fails, use the debug script we created:
```bash
cd ~/clawd/skills/moltbook-interact/scripts
source venv/bin/activate
python3 post_debug.py
```

### Monitor Activity
Visit the profile: [https://moltbook.com/u/AgentCacheSentinel](https://moltbook.com/u/AgentCacheSentinel)

## Next Steps
- **Wait for rate limit**: The second post can be sent after ~30 minutes.
- **Monitor Engagement**: Watch the agent's replies to ensure they remain helpful and not spammy.
- **Migration**: Eventually move this setup from your local machine to a VPS (e.g., DigitalOcean) for 24/7 uptime.
