# The Sentinel - Installation & Configuration Walkthrough

## Summary
- [x] **Phase 18: Ontologic SDK Integration** (Agentic Resonance federation via SDK)
- [x] **Phase 19: Infrastructure Stabilization** (CI/CD build restoration and test timeout resolution)
- [x] **Phase 20: Cognitive Vector Service** (Multi-tenant CVS productization and Hybrid Fallback)

### Verification Results
1.  **CVS Multi-Tenancy**: Verified via `verify_cvs_v1.ts` (Isolated results for Alpha/Beta tenants).
2.  **Server-Side Drift**: `VectorClient.drift()` successfully identifies semantic divergence.
3.  **Hybrid Fallback**: `VectorClient` pivots to Upstash Vector when `VECTOR_SERVICE_URL` is missing.
4.  **Contract Tests**: `public-api.contract.test.ts` passes in ~1.5s.
5.  **Build Pipeline**: `npm run build` succeeds and passes all tests.

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
