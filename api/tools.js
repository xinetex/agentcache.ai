/**
 * Folder Tools Registry — ComfyUI-style connectable nodes for the api/ surface
 *
 * PERMANENT surface (the registry + port contract shape should survive into Hono).
 * This wires the "Tools palette" + port contracts into the legacy AgentCache api.
 * Tools can be discovered, wired on the canvas (via workflows.js connections),
 * and executed with GroundedReceipt emission (via nodes.js trigger/upload paths).
 *
 * Matches the Aletheia vision: folder tools as first-class connectable nodes
 * with explicit input/output ports, tooltips, sector/MCP/builtin classification,
 * and transferability.
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Static registry for v0.1 — easily extensible.
// Each tool declares ports exactly like ComfyUI nodes.
const TOOL_REGISTRY = [
  {
    id: 'builtin.summarize',
    name: 'Summarize',
    type: 'builtin',
    description: 'Produce a concise, grounded summary of input text or files. Emits RuntimeTruth + Invention records.',
    category: 'analysis',
    ports: {
      input: [
        { name: 'text', type: 'string', description: 'Primary content to summarize' },
        { name: 'max_tokens', type: 'number', description: 'Soft cap on output length' },
      ],
      output: [
        { name: 'summary', type: 'string' },
        { name: 'key_facts', type: 'array' },
        { name: 'receipt_id', type: 'string' },
      ],
    },
    tooltip: 'Use after file upload or node write. Always produces a signed GroundedReceipt.',
    requires_auth: false,
  },
  {
    id: 'builtin.classify',
    name: 'Classify',
    type: 'builtin',
    description: 'Intent-aware classification. Suggests downstream actions and tags.',
    category: 'analysis',
    ports: {
      input: [{ name: 'content', type: 'any' }],
      output: [{ name: 'labels', type: 'array' }, { name: 'suggested_actions', type: 'array' }],
    },
    tooltip: 'Core of property-based file actions in the smart folder.',
  },
  {
    id: 'sector.entity-extract',
    name: 'Entity Extract',
    type: 'sector',
    description: 'Sector pack: legal/financial entity extraction with policy guardrails.',
    category: 'transform',
    ports: {
      input: [{ name: 'document', type: 'file|text' }],
      output: [{ name: 'entities', type: 'array' }, { name: 'grounded_claims', type: 'array' }],
    },
    tooltip: 'Install via templates.js then wire on the canvas. Emits Invention-flagged receipts on uncertainty.',
  },
  {
    id: 'mcp.web-search',
    name: 'Web Search (MCP)',
    type: 'mcp',
    description: 'External MCP tool. Grounded by cache + memory recall before external call.',
    category: 'external',
    ports: {
      input: [{ name: 'query', type: 'string' }],
      output: [{ name: 'results', type: 'array' }, { name: 'cached', type: 'boolean' }],
    },
    tooltip: 'Preferred over raw LLM calls. Results are receipted for drift detection.',
  },
  {
    id: 'action.notify',
    name: 'Notify',
    type: 'action',
    description: 'Send notification (email/slack/webhook) with receipt attachment.',
    category: 'output',
    ports: {
      input: [{ name: 'message', type: 'string' }, { name: 'targets', type: 'array' }],
      output: [{ name: 'delivered', type: 'boolean' }, { name: 'receipt', type: 'object' }],
    },
  },
  {
    id: 'action.export',
    name: 'Export',
    type: 'action',
    description: 'Export node/folder contents or receipt bundle to external store (S3, Lyve, etc.).',
    category: 'output',
    ports: {
      input: [{ name: 'format', type: 'string' }, { name: 'target', type: 'string' }],
      output: [{ name: 'uri', type: 'string' }],
    },
  },
];

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

    if (req.method === 'GET' || action === 'list') {
      return json({
        success: true,
        tools: TOOL_REGISTRY,
        meta: {
          version: '0.1',
          note: 'Wire these on the canvas via /api/workflows?action=connect. Execution emits GroundedReceipts.',
        },
      });
    }

    if (req.method === 'POST' && action === 'execute') {
      const body = await req.json();
      const { toolId, input, nodeId, workflowId } = body;

      const tool = TOOL_REGISTRY.find(t => t.id === toolId);
      if (!tool) {
        return json({ error: 'Unknown tool', available: TOOL_REGISTRY.map(t => t.id) }, 404);
      }

      // Minimal execution stub that still produces a real GroundedReceipt via the lib
      // In a fuller wiring this would call the actual impl and pass real runtime trace.
      const { buildAndSignReceipt } = await import('./lib/grounded-receipt.js');

      const receipt = await buildAndSignReceipt({
        agentCacheRunId: 'tools-execute',
        workflowId: workflowId || nodeId || 'tool-run',
        spec: {
          declared_phases: [{ name: 'tool-execution' }],
          applicable_policies: [],
          expected_tools: [{ name: toolId, description: tool.description }],
          knowledge_context_ids: [],
          source: 'user_declared',
        },
        runtime: {
          actual_phases: [{ name: 'execute', status: 'completed' }],
          tool_calls: [{
            tool_name: toolId,
            mcp_server: tool.type === 'mcp' ? toolId : undefined,
            input_hash: Buffer.from(JSON.stringify(input || {})).toString('base64').slice(0, 32),
            duration_ms: 12,
          }],
          memory_operations: [],
          timestamps: { start: new Date().toISOString(), end: new Date().toISOString(), key_events: {} },
          artifacts: [{ id: nodeId || 'tool-output', type: 'tool_result' }],
        },
        inventions: [],
      });

      return json({
        success: true,
        tool: tool.name,
        executed_at: receipt.created_at,
        receipt,
        note: 'Real GroundedReceipt emitted. In production this would call the actual tool implementation.',
      }, 201);
    }

    return json({ error: 'Invalid action' }, 400);
  } catch (err) {
    console.error('[Tools API] Error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
}
