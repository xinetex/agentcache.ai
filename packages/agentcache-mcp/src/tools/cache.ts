/** @agentcache/mcp — cache tools (self-contained). */
import { ToolModule, ToolHandlerContext } from '../registry.js';

const BASE = process.env.AGENTCACHE_API_URL || 'https://agentcache.ai';

async function call(path: string, method: string, body: any, apiKey: string, extra: Record<string,string> = {}) {
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    ...extra,
  };
  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`AgentCache API error: ${data.error || res.statusText}`);
  return data;
}

const ok = (obj: any) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

export const CacheTools: ToolModule = {
  tools: [
    {
      name: 'agentcache_get',
      description: 'Check the AgentCache key/value cache before making an expensive model call. Returns { hit, value }. A miss is a normal 200 with hit:false, not an error. Pass X-Model + token counts via the model/inputTokens/outputTokens args so any hit is priced into your savings ledger.',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Cache key (e.g. a hash of the prompt)' },
          namespace: { type: 'string', description: 'Tenant/workspace scope. Default: "default"' },
          model: { type: 'string', description: 'Model this call would use, for savings pricing' },
          inputTokens: { type: 'number' },
          outputTokens: { type: 'number' },
        },
        required: ['key'],
      },
    },
    {
      name: 'agentcache_set',
      description: 'Store a model response in the AgentCache key/value cache so the next identical call is served instantly. Call after a cache miss + provider response.',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { description: 'The response payload to cache (any JSON)' },
          namespace: { type: 'string', description: 'Tenant/workspace scope. Default: "default"' },
        },
        required: ['key', 'value'],
      },
    },
  ],
  handlers: {
    agentcache_get: async (args: any, ctx: ToolHandlerContext) => {
      const ns = args?.namespace || 'default';
      const extra: Record<string,string> = { 'X-Cache-Namespace': ns };
      if (args?.model) extra['X-Model'] = String(args.model);
      if (args?.inputTokens != null) extra['X-Input-Tokens'] = String(args.inputTokens);
      if (args?.outputTokens != null) extra['X-Output-Tokens'] = String(args.outputTokens);
      const data = await call(`/api/cache/get?key=${encodeURIComponent(args?.key || '')}`, 'GET', null, ctx.apiKey, extra);
      return ok(data);
    },
    agentcache_set: async (args: any, ctx: ToolHandlerContext) => {
      const ns = args?.namespace || 'default';
      const data = await call('/api/cache/set', 'POST', { key: args?.key, value: args?.value }, ctx.apiKey, { 'X-Cache-Namespace': ns });
      return ok(data);
    },
  },
};
