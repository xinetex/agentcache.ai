/**
 * @agentcache/mcp — agent-facing MCP for the AgentCache control plane.
 * Caching + pre-spend governance gate + verifiable savings + cross-run reasoning.
 * Set AGENTCACHE_API_KEY (ac_live_…). Optionally AGENTCACHE_API_URL for self-host.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from './registry.js';
import { CacheTools } from './tools/cache.js';
import { ControlPlaneTools } from './tools/controlplane.js';
const registry = new ToolRegistry();
registry.registerModule(CacheTools);
registry.registerModule(ControlPlaneTools);
const API_KEY = process.env.AGENTCACHE_API_KEY || process.env.API_KEY || '';
if (!API_KEY)
    console.error('[agentcache-mcp] AGENTCACHE_API_KEY not set — calls will be unauthenticated.');
const server = new Server({ name: 'agentcache', version: '0.1.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: registry.getTools() }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        const handler = registry.getHandler(name);
        if (!handler)
            throw new Error(`Tool not found: ${name}`);
        return await handler(args, { apiKey: API_KEY, request });
    }
    catch (error) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `AgentCache Error: ${error instanceof Error ? error.message : String(error)}` }) }], isError: true };
    }
});
const transport = new StdioServerTransport();
server.connect(transport).catch((e) => { console.error('agentcache-mcp fatal:', e); process.exit(1); });
