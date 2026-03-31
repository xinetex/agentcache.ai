# MCP Containment

The AgentCache MCP server should not run with unrestricted access to a developer host.

## Default Rule

Run the MCP server in a contained Docker runtime unless you intentionally accept host-secret exposure risk.

## Why

An MCP server is code execution with network access. If it runs on a host that also carries:

- SSH agent access
- cloud credentials
- production database URLs
- signing secrets
- wallet material
- GitHub or Vercel tokens

then a malicious dependency or compromised runtime can exfiltrate them.

## Safer Path

Use the contained runner:

```bash
export AGENTCACHE_API_KEY=ac_live_xxx
npm run mcp:container-run
```

This path:

- builds `Dockerfile.mcp`
- runs the server as a non-root user
- uses a read-only filesystem
- drops Linux capabilities
- enables `no-new-privileges`
- limits CPU, memory, and process count
- passes only `AGENTCACHE_API_KEY`, `AGENTCACHE_API_URL`, and `AGENTCACHE_MCP_SANDBOX`

## Host Secret Guard

[src/mcp/server.ts](/Users/letstaco/Documents/agentcache-ai/src/mcp/server.ts) now refuses to start if sensitive host environment variables are present, unless you explicitly override it:

```bash
AGENTCACHE_MCP_ALLOW_HOST_SECRETS=1 npm run mcp:dev
```

Use that override only for deliberate local debugging.

## Recommended Claude Desktop Shape

Point Claude Desktop or other MCP clients at the contained runner instead of raw `node`:

```json
{
  "mcpServers": {
    "agentcache": {
      "command": "sh",
      "args": ["/absolute/path/to/scripts/run-mcp-contained.sh"],
      "env": {
        "AGENTCACHE_API_KEY": "ac_live_xxx",
        "AGENTCACHE_API_URL": "https://agentcache.ai"
      }
    }
  }
}
```

## Near-Term Follow-Ups

1. Move third-party MCP servers to the same containment pattern.
2. Add egress restrictions for MCP containers where practical.
3. Remove production credentials from developer shells entirely.
