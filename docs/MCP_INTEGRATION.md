# AgentCache MCP Server Integration

## Overview

This document outlines the architecture for exposing AgentCache as a Model Context Protocol (MCP) server, enabling rtrvr.ai agents and other MCP clients to cache LLM calls transparently.

## Architecture

### MCP Server Type: **Tools Server**

AgentCache will expose **Tools** (callable functions) rather than Resources or Prompts. This allows LLM agents to actively check, retrieve, and store cache entries during execution.

### Transport Support

1. **HTTP/SSE Transport** (Primary)
   - Target: Remote clients like rtrvr.ai
   - Endpoint: `https://agentcache.ai/mcp` or dedicated subdomain
   - Supports server-sent events for notifications
   - Authentication via existing API key system

2. **STDIO Transport** (Secondary)
   - Target: Local clients (Claude Desktop, etc.)
   - Launched as subprocess
   - Useful for testing and development

## MCP Tools Exposed

### 1. `agentcache_get`
**Description**: Check if a prompt response exists in cache and retrieve it

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": ["openai", "anthropic", "google"],
      "description": "LLM provider name"
    },
    "model": {
      "type": "string",
      "description": "Model identifier (e.g., 'gpt-4', 'claude-3-opus')"
    },
    "messages": {
      "type": "array",
      "description": "Conversation messages",
      "items": {
        "type": "object",
        "properties": {
          "role": {"type": "string"},
          "content": {"type": "string"}
        }
      }
    },
    "temperature": {
      "type": "number",
      "default": 0.7
    },
    "namespace": {
      "type": "string",
      "description": "Optional cache namespace for multi-tenancy"
    }
  },
  "required": ["provider", "model", "messages"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "cached": {"type": "boolean"},
    "response": {
      "type": "object",
      "description": "Cached LLM response if found"
    },
    "latency_ms": {"type": "number"},
    "ttl_remaining": {"type": "number"}
  }
}
```

**Maps to**: `POST /api/cache/get`

---

### 2. `agentcache_set`
**Description**: Store an LLM response in cache for future reuse

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "provider": {"type": "string"},
    "model": {"type": "string"},
    "messages": {"type": "array"},
    "temperature": {"type": "number"},
    "response": {
      "type": "object",
      "description": "LLM response to cache"
    },
    "namespace": {"type": "string"},
    "ttl": {
      "type": "number",
      "description": "Cache TTL in seconds (default: 604800 = 7 days)"
    }
  },
  "required": ["provider", "model", "messages", "response"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "cached": {"type": "boolean"},
    "cache_key": {"type": "string"},
    "expires_at": {"type": "string"}
  }
}
```

**Maps to**: `POST /api/cache/set`

---

### 3. `agentcache_check`
**Description**: Check if a prompt is cached without retrieving the response

**Input Schema**: Same as `agentcache_get` (minus response retrieval)

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "cached": {"type": "boolean"},
    "ttl_remaining": {"type": "number"},
    "cache_size_bytes": {"type": "number"}
  }
}
```

**Maps to**: `POST /api/cache/check`

---

### 4. `agentcache_stats`
**Description**: Get caching statistics and quota information

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "period": {
      "type": "string",
      "enum": ["24h", "7d", "30d"],
      "default": "24h"
    },
    "namespace": {"type": "string"}
  }
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "period": {"type": "string"},
    "namespace": {"type": "string"},
    "metrics": {
      "type": "object",
      "properties": {
        "total_requests": {"type": "number"},
        "cache_hits": {"type": "number"},
        "hit_rate": {"type": "number"},
        "tokens_saved": {"type": "number"},
        "cost_saved": {"type": "string"}
      }
    },
    "quota": {
      "type": "object",
      "properties": {
        "monthly_limit": {"type": "number"},
        "monthly_used": {"type": "number"},
        "monthly_remaining": {"type": "number"}
      }
    }
  }
}
```

**Maps to**: `GET /api/stats`

## Implementation Plan

### Phase 1: TypeScript MCP Server (Recommended)
**Why TypeScript?**
- rtrvr.ai appears to be Node.js-based (their demo mentions TypeScript)
- MCP TypeScript SDK is mature and well-documented
- Can reuse existing Hono patterns from `/src/index.ts`
- Better HTTP/SSE support than Python SDK

**Files to Create**:
```
/src/mcp/
  ├── server.ts          # Main MCP server
  ├── tools/
  │   ├── get.ts         # agentcache_get implementation
  │   ├── set.ts         # agentcache_set implementation
  │   ├── check.ts       # agentcache_check implementation
  │   └── stats.ts       # agentcache_stats implementation
  ├── transport/
  │   ├── http.ts        # HTTP/SSE transport
  │   └── stdio.ts       # STDIO transport (testing)
  └── types.ts           # Shared TypeScript types
```

### Phase 2: Vercel Edge Deployment
- Deploy MCP server as Vercel Edge Function
- Endpoint: `/api/mcp` or separate `mcp.agentcache.ai` subdomain
- Reuse existing API key authentication
- Connect to same Upstash Redis instance

### Phase 3: Client Configuration
**For rtrvr.ai:**
```json
{
  "mcpServers": {
    "agentcache": {
      "url": "https://agentcache.ai/api/mcp",
      "transport": "sse",
      "headers": {
        "X-API-Key": "ac_live_xxx"
      }
    }
  }
}
```

**For Claude Desktop (local testing):**
```json
{
  "mcpServers": {
    "agentcache": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": {
        "API_KEY": "ac_demo_test123"
      }
    }
  }
}
```

## Usage Flow (rtrvr.ai Example)

### Agent Workflow:
1. **Agent receives task**: "Research competitor pricing"
2. **Before calling OpenAI**:
   - Call `agentcache_get` tool with prompt details
   - If `cached: true`, use returned response (10x faster, 90% cheaper)
   - If `cached: false`, proceed to step 3
3. **Call OpenAI** normally
4. **After receiving response**:
   - Call `agentcache_set` to store response
   - Future identical prompts hit cache

### Automatic Caching (Advanced):
rtrvr.ai could wrap all LLM calls with AgentCache tools automatically, making caching transparent to end users.

## Benefits for rtrvr.ai

### 1. **Parallel Research Cost Reduction**
- 10 agents researching same competitor = 90% cache hit rate
- $100/day LLM costs → $10/day

### 2. **Monitoring Efficiency**
- 24/7 monitoring of unchanged pages = 100% cache hits after first check
- Hourly checks become free (cached)

### 3. **Multi-Tenant Value**
- Use namespaces to segment cache by customer
- Example: `namespace: "customer_acme"` vs `namespace: "customer_beta"`

### 4. **Developer Experience**
- One MCP connection = instant caching
- No SDK changes required
- Works with any LLM provider

## Security & Rate Limiting

### Authentication
- Existing API key system (ac_demo_*, ac_live_*)
- Keys passed via HTTP headers or environment variables
- Same quota enforcement as REST API

### Rate Limiting
- MCP calls count toward existing rate limits
- 100 req/min for demo keys
- 500 req/min for live keys

## Monitoring & Observability

### MCP-Specific Metrics (to add):
```
mcp:connections:active
mcp:tools:calls:total
mcp:tools:calls:by_tool
mcp:transport:http:requests
mcp:transport:stdio:sessions
```

### Logs:
- MCP connection events
- Tool invocation traces
- Error rates by tool

## Testing Strategy

### Unit Tests
- Tool schema validation
- Input/output type checking
- Cache key generation consistency

### Integration Tests
- MCP Inspector (official MCP testing tool)
- Mock rtrvr.ai client scenarios
- Claude Desktop local testing

### Load Tests
- 100 concurrent MCP connections
- 1000 tools/min throughput
- Latency under 100ms for cache hits

## Documentation Deliverables

1. **rtrvr.ai Integration Guide** (docs/RTRVR_INTEGRATION.md)
2. **MCP Server API Reference** (auto-generated from tool schemas)
3. **Demo Video**: Showing rtrvr.ai agent using AgentCache via MCP
4. **Case Study**: "10x Cost Reduction for rtrvr.ai Web Research"

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Design (this doc) | 1 hour | ✅ Done |
| TypeScript MCP Server | 4 hours | 🔄 Next |
| Vercel Deployment | 2 hours | ⏳ Pending |
| Testing | 2 hours | ⏳ Pending |
| Documentation | 2 hours | ⏳ Pending |
| rtrvr.ai Outreach | 1 hour | ⏳ Pending |

**Total**: ~12 hours of development

## Success Metrics

- [ ] MCP server passes MCP Inspector tests
- [ ] Successfully connects from Claude Desktop
- [ ] rtrvr.ai demo shows <50ms cache hit latency
- [ ] 80%+ cache hit rate in rtrvr.ai parallel research scenario
- [ ] Zero downtime deployment to Vercel Edge

## References

- [MCP Specification](https://modelcontextprotocol.io/docs/getting-started/intro)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server)
- [rtrvr.ai MCP Documentation](https://rtrvr.ai/docs)
