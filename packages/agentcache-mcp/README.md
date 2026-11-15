# agentcache-mcp

The agent-facing **MCP server** for the [AgentCache](https://agentcache.ai) control plane.
Give any MCP-capable agent (Claude Desktop, Cursor, …) access to AgentCache's governed execution workflow,
alongside caching and cross-run memory. Cache savings reports are modeled from recorded events and pricing assumptions.

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
| `agentcache_savings` | Modeled cache savings + ROI, by layer and model; not invoice reconciled. |
| `agentcache_reasoning_resume` | Resume prior reasoning for a recurring task. |
| `agentcache_reasoning_commit` | Persist what this run learned for the next run. |
| `agentcache_execution_tools` | Discover the authenticated execution actions and their requirements. |
| `agentcache_execution_context_packs` / `agentcache_execution_create_context_pack` / `agentcache_execution_context_pack` | List, define, and read owned workflow definitions. |
| `agentcache_execution_connections` / `agentcache_execution_connect` / `agentcache_execution_disconnect` | Manage owned provider connections. Credential material is encrypted by AgentCache and never returned by list/read calls. |
| `agentcache_execution_start` / `agentcache_execution_status` / `agentcache_execution_advance_phase` | Start and inspect a governed run; phase advancement cannot approve a human gate. |
| `agentcache_execution_invoke_jetty_summary` | Invoke the supported read-only Jetty storage summary after policy and gate checks. It returns aggregate quota and file count only. |
| `agentcache_execution_invocations` / `agentcache_execution_invocation_history` / `agentcache_execution_decision_history` | Inspect durable, redacted run evidence and decisions. |
| `agentcache_execution_usage` | Read pilot measurement counts; it does not create a charge. |

Gate approval remains a human action by a different owner/admin member of the same organization, completed through the AgentCache console or gate API. This package does not expose gate decisions, platform break-glass approval, or arbitrary MCP proxying.

## Config

- `AGENTCACHE_API_KEY` — your AgentCache API key (required for every tool call; no demo key is substituted when it is missing).
- `AGENTCACHE_API_URL` — override the API base (default `https://agentcache.ai`), for self-hosting.

## Develop / publish

```bash
npm install      # gets the toolchain
npm run build    # tsc -> dist/
npm publish   # you are already logged in as verdoni
```

Docs: https://agentcache.ai/docs
