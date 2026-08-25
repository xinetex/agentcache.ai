# agentcache-mcp

The agent-facing **MCP server** for the [AgentCache](https://agentcache.ai) control plane.
Give any MCP-capable agent (Claude Desktop, Cursor, …) the AgentCache control plane in one line:
caching, a **pre-spend governance gate**, **verifiable savings**, and **cross-run reasoning memory**.

## Install

Add to your MCP config (e.g. `claude_desktop_config.json` or Cursor `mcp.json`):

```json
{
  "mcpServers": {
    "agentcache": {
      "command": "npx",
      "args": ["-y", "agentcache-mcp"],
      "env": { "AGENTCACHE_API_KEY": "ac_live_..." }
    }
  }
}
```

Get an `ac_live_` key at https://agentcache.ai/onboarding.html.

## Tools

| Tool | What it does |
|------|--------------|
| `agentcache_get` | Check the cache before an expensive call (miss = normal, `hit:false`). |
| `agentcache_set` | Store a response so the next identical call is instant. |
| `agentcache_gate` | **Before spending**, ask if a call is within budget / quota / anomaly / kill-switch. |
| `agentcache_savings` | Verified net dollars saved + ROI, by layer and model. |
| `agentcache_reasoning_resume` | Resume prior reasoning for a recurring task. |
| `agentcache_reasoning_commit` | Persist what this run learned for the next run. |

## Config

- `AGENTCACHE_API_KEY` — your `ac_live_` key (required).
- `AGENTCACHE_API_URL` — override the API base (default `https://agentcache.ai`), for self-hosting.

## Develop / publish

```bash
npm install      # gets the toolchain
npm run build    # tsc -> dist/
npm publish   # you are already logged in as verdoni
```

Docs: https://agentcache.ai/docs
