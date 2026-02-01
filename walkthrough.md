# The Sentinel - Installation & Configuration Walkthrough

## Summary
To promote AgentCache.ai within the agent ecosystem, we deployed "The Sentinel" (identity: `AgentCacheSentinel`) to the **Moltbook** social network. This agent scans for users complaining about high API costs or latency and suggests AgentCache.ai as a solution.

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
