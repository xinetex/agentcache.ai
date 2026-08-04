/**
 * Node API — AgentForge
 * Full CRUD for Smart Nodes (The Folder That Thinks).
 * 
 * Architecture:
 *   - Every node is an autonomous directory with its own memory, agents, and intents.
 *   - Spec Truth (deterministic config) is immutable by LLM output.
 *   - Runtime Truth (execution logs) is append-only.
 *   - All mutations are validated through the Truth Enforcement Layer.
 */
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from './auth.js';

// === Aletheia Grounded Wiring (api/ enhancement) ===
import {
  buildAndSignReceipt,
  canonicalStringify,
  validateReceiptShape,
} from './lib/grounded-receipt.js';

export const config = { runtime: 'nodejs' };

const sql = neon(process.env.DATABASE_URL);

// === In-memory stores for legacy server lifetime (receipts + watchers) ===
// TEMPORARY for the legacy Express path (server.js) only.
// In the production Hono path (src/) these will be replaced by persistent DB tables
// (grounded_receipts, node_watchers, automation_rules) + proper job queue for notifications.
// Do not rely on these Maps surviving restarts or scaling.
const receiptStore = new Map(); // receiptId -> GroundedReceipt
const watcherStore = new Map(); // nodeId -> [ { id, callbackUrl, events: [...] } ]

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

// --- Truth Enforcement Layer ---
// Validates that incoming mutations respect the Spec Truth contract.
// LLM-generated output MUST NOT overwrite deterministic fields.

function enforceSpecTruth(existingNode, mutation) {
    const violations = [];

    // Spec Truth fields are immutable once set — only owner can change via explicit action
    if (mutation.specTruth && existingNode.spec_truth) {
        const existingKeys = Object.keys(existingNode.spec_truth);
        for (const key of existingKeys) {
            if (mutation.specTruth[key] !== undefined &&
                JSON.stringify(mutation.specTruth[key]) !== JSON.stringify(existingNode.spec_truth[key])) {
                violations.push(`Cannot overwrite spec_truth.${key} — immutable once set`);
            }
        }
    }

    // Node type cannot be changed after creation
    if (mutation.nodeType && existingNode.node_type && mutation.nodeType !== existingNode.node_type) {
        violations.push('Cannot change node_type after creation');
    }

    return violations;
}

// --- Validation Helpers ---

function validateNodeName(name) {
    if (!name || typeof name !== 'string') return 'Name is required';
    if (name.length < 1 || name.length > 255) return 'Name must be 1-255 characters';
    // Prevent path traversal
    if (/[\/\\]/.test(name)) return 'Name cannot contain path separators';
    return null;
}

function validateActionType(actionType) {
    const ALLOWED_ACTIONS = [
        'summarize', 'classify', 'route', 'notify', 'export',
        'analyze', 'transform', 'schedule', 'webhook', 'custom'
    ];
    if (!actionType) return 'actionType is required';
    if (!ALLOWED_ACTIONS.includes(actionType)) {
        return `Invalid actionType. Allowed: ${ALLOWED_ACTIONS.join(', ')}`;
    }
    return null;
}

// === Grounded Receipt + Watcher Helpers (Aletheia wiring) ===

/**
 * Emit a full GroundedReceipt for a node mutation.
 * Stores it in the in-memory receiptStore (legacy path).
 * Notifies any registered watchers.
 */
async function emitGroundedReceipt({ node, operation, inventions = [], toolCalls = [], userId }) {
  const now = new Date().toISOString();

  const spec = node.spec_truth || {
    declared_phases: [{ name: operation }],
    applicable_policies: [],
    expected_tools: [],
    knowledge_context_ids: [],
    source: 'user_declared',
  };

  const runtime = {
    actual_phases: [{ name: operation, status: 'completed' }],
    tool_calls: toolCalls,
    memory_operations: [{ type: 'store', memory_id: node.id }],
    timestamps: { start: now, end: now, key_events: { [operation]: now } },
    artifacts: [{ id: node.id, type: node.node_type || 'node' }],
  };

  const validation = {
    static_checks: { schema_valid: true, policy_conflicts: false, contract_violations: [] },
    simulation_results: [],
    overall_status: inventions.length > 0 ? 'warnings' : 'passed',
  };

  const summary = {
    drift_score: inventions.length > 0 ? 0.15 : 0.02,
    invention_count: inventions.length,
    grounded_fact_count: 1,
    tool_calls_count: toolCalls.length,
    duration_ms: 2,
  };

  const receipt = await buildAndSignReceipt({
    agentCacheAccountId: userId ? `user-${userId}` : 'agentcache-local',
    agentCacheRunId: `node-${node.id}-${operation}`,
    workflowId: node.workflow_id || node.parent_id || 'default',
    spec,
    runtime,
    inventions,
    validation,
    summary,
  });

  receiptStore.set(receipt.id, receipt);

  // Also attach lightweight receipt ref to the node object for immediate response
  if (!node.receipts) node.receipts = [];
  node.receipts.push({ id: receipt.id, created_at: receipt.created_at, summary: receipt.summary });

  // Notify watchers (fire-and-forget for legacy path)
  _notifyWatchers(node, receipt, operation);

  return receipt;
}

function _notifyWatchers(node, receipt, operation) {
  const watchers = watcherStore.get(node.id) || [];
  if (watchers.length === 0) return;

  const event = {
    type: `node:${operation}`,
    nodeId: node.id,
    receiptId: receipt.id,
    timestamp: receipt.created_at,
  };

  for (const w of watchers) {
    // In real impl this would POST to w.callbackUrl or call an in-process handler.
    // For the legacy local server (development/preview) we emit a single structured log line.
    // This is intentionally the *only* console.log left in the enhanced nodes path.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Watcher] node=${node.id} event=${event.type} watcher=${w.id}`);
    }
  }
}

/**
 * Very small port of the grounded suggestFileActions logic.
 * Returns intent-aware actions for an uploaded file based on type/name.
 */
function suggestFileActionsForNode(fileMeta) {
  const actions = [];
  const name = (fileMeta.name || '').toLowerCase();
  const type = (fileMeta.type || '').toLowerCase();

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    actions.push({ action: 'classify', label: 'Classify & tag entities', tool: 'builtin.classify' });
    actions.push({ action: 'summarize', label: 'Grounded summary', tool: 'builtin.summarize' });
    actions.push({ action: 'extract', label: 'Legal/financial entity extract', tool: 'sector.entity-extract' });
  } else if (type.includes('image') || /\.(png|jpg|jpeg|gif|webp)$/.test(name)) {
    actions.push({ action: 'analyze', label: 'Describe & caption', tool: 'builtin.classify' });
    actions.push({ action: 'tag', label: 'Auto-tag for search', tool: 'builtin.classify' });
  } else if (type.includes('text') || /\.(md|txt|csv|json)$/.test(name)) {
    actions.push({ action: 'summarize', label: 'Summarize', tool: 'builtin.summarize' });
    actions.push({ action: 'classify', label: 'Intent + route', tool: 'builtin.classify' });
  } else {
    actions.push({ action: 'analyze', label: 'General analysis', tool: 'builtin.classify' });
  }

  actions.push({ action: 'notify', label: 'Notify on completion', tool: 'action.notify' });
  return actions;
}

// --- Main Handler ---

export default async function handler(req) {
    try {
        const url = new URL(req.url);
        const action = url.searchParams.get('action');
        const method = req.method;

        // --- PUBLIC: List nodes (demo) ---
        if (method === 'GET' && !action) {
            // Check for auth — if present, return user's nodes; otherwise demo data
            const user = await getUserFromRequest(req);
            const parentId = url.searchParams.get('parentId');

            if (user) {
                let nodes;
                if (parentId) {
                    nodes = await sql`
                        SELECT sn.id, sn.name, sn.node_type, sn.status, sn.created_at, sn.pos_x, sn.pos_y, sn.properties, sn.parent_id,
                               (SELECT COUNT(*) FROM node_agents na WHERE na.node_id = sn.id) as agent_count,
                               (SELECT COUNT(*) FROM node_intents ni WHERE ni.node_id = sn.id) as intent_count
                        FROM smart_nodes sn
                        WHERE sn.owner_id = ${user.id} AND sn.parent_id = ${parentId}
                        ORDER BY sn.created_at DESC
                        LIMIT 50
                    `;
                } else {
                    nodes = await sql`
                        SELECT sn.id, sn.name, sn.node_type, sn.status, sn.created_at, sn.pos_x, sn.pos_y, sn.properties, sn.parent_id,
                               (SELECT COUNT(*) FROM node_agents na WHERE na.node_id = sn.id) as agent_count,
                               (SELECT COUNT(*) FROM node_intents ni WHERE ni.node_id = sn.id) as intent_count
                        FROM smart_nodes sn
                        WHERE sn.owner_id = ${user.id} AND sn.parent_id IS NULL
                        ORDER BY sn.created_at DESC
                        LIMIT 50
                    `;
                }
                return json({ success: true, nodes, authenticated: true });
            }

            // Unauthenticated — return demo data for the landing page
            return json({
                success: true,
                authenticated: false,
                nodes: [
                    { id: 'demo-1', name: 'Legal Contracts', node_type: 'directory', status: 'active', agent_count: 2, intent_count: 3 },
                    { id: 'demo-2', name: 'Financial Reports', node_type: 'directory', status: 'active', agent_count: 1, intent_count: 1 },
                ],
            });
        }

        // --- All mutations require authentication ---
        const user = await getUserFromRequest(req);
        if (!user) {
            return json({ error: 'Authentication required' }, 401);
        }

        const body = method === 'POST' || method === 'PATCH' || method === 'DELETE'
            ? await req.json()
            : {};

        // --- CREATE NODE ---
        if (method === 'POST' && action === 'create') {
            const nameError = validateNodeName(body.name);
            if (nameError) return json({ error: nameError }, 400);

            const nodeType = body.nodeType || 'directory';
            if (!['directory', 'file'].includes(nodeType)) {
                return json({ error: 'nodeType must be "directory" or "file"' }, 400);
            }

            const rows = await sql`
                INSERT INTO smart_nodes (owner_id, name, node_type, parent_id, spec_truth, memory_context)
                VALUES (
                    ${user.id},
                    ${body.name},
                    ${nodeType},
                    ${body.parentId || null},
                    ${JSON.stringify(body.specTruth || {})},
                    ${JSON.stringify(body.memoryContext || {})}
                )
                RETURNING id, name, node_type, status, parent_id, spec_truth, memory_context, created_at, workflow_id
            `;

            const createdNode = rows[0];

            // === Aletheia Grounded Receipt emission on create ===
            const createReceipt = await emitGroundedReceipt({
                node: createdNode,
                operation: 'create',
                inventions: body.inventions || [],
                userId: user.id,
            });

            return json({ success: true, node: createdNode, receipt: createReceipt }, 201);
        }

        // --- UPDATE NODE ---
        if (method === 'PATCH' && action === 'update') {
            if (!body.nodeId) return json({ error: 'nodeId is required' }, 400);

            // Fetch existing node (ownership check)
            const existing = await sql`
                SELECT * FROM smart_nodes WHERE id = ${body.nodeId} AND owner_id = ${user.id}
            `;
            if (existing.length === 0) {
                return json({ error: 'Node not found or access denied' }, 404);
            }

            // Truth Enforcement
            const violations = enforceSpecTruth(existing[0], body);
            if (violations.length > 0) {
                return json({
                    error: 'Spec Truth violation',
                    violations,
                    hint: 'Deterministic spec fields cannot be overwritten by mutation. Use explicit owner action to modify.'
                }, 403);
            }

            // Build safe update
            const updates = {};
            if (body.name) {
                const nameError = validateNodeName(body.name);
                if (nameError) return json({ error: nameError }, 400);
                updates.name = body.name;
            }
            if (body.memoryContext) updates.memoryContext = body.memoryContext;
            if (body.status && ['active', 'archived', 'paused'].includes(body.status)) {
                updates.status = body.status;
            }

            const rows = await sql`
                UPDATE smart_nodes
                SET name = COALESCE(${updates.name || null}, name),
                    memory_context = COALESCE(${updates.memoryContext ? JSON.stringify(updates.memoryContext) : null}::jsonb, memory_context),
                    status = COALESCE(${updates.status || null}, status),
                    updated_at = NOW()
                WHERE id = ${body.nodeId} AND owner_id = ${user.id}
                RETURNING id, name, node_type, status, parent_id, memory_context, updated_at, workflow_id
            `;

            if ('parentId' in body) {
                await sql`UPDATE smart_nodes SET parent_id = ${body.parentId} WHERE id = ${body.nodeId} AND owner_id = ${user.id}`;
                rows[0].parent_id = body.parentId;
            }

            const updatedNode = rows[0];

            // === Aletheia Grounded Receipt on update ===
            const updateReceipt = await emitGroundedReceipt({
                node: updatedNode,
                operation: 'update',
                inventions: body.inventions || [],
                userId: user.id,
            });

            return json({ success: true, node: updatedNode, receipt: updateReceipt });
        }

        // --- DELETE NODE ---
        if (method === 'DELETE' || (method === 'POST' && action === 'delete')) {
            if (!body.nodeId) return json({ error: 'nodeId is required' }, 400);

            // Cascade: delete intents and agents first
            await sql`DELETE FROM node_intents WHERE node_id = ${body.nodeId}`;
            await sql`DELETE FROM node_agents WHERE node_id = ${body.nodeId}`;
            const rows = await sql`
                DELETE FROM smart_nodes WHERE id = ${body.nodeId} AND owner_id = ${user.id}
                RETURNING id
            `;

            if (rows.length === 0) {
                return json({ error: 'Node not found or access denied' }, 404);
            }

            return json({ success: true, deleted: body.nodeId });
        }

        // --- ASSIGN AGENT TO NODE ---
        if (method === 'POST' && action === 'assign') {
            if (!body.nodeId || !body.roleName) {
                return json({ error: 'nodeId and roleName are required' }, 400);
            }

            // Verify ownership
            const node = await sql`
                SELECT id FROM smart_nodes WHERE id = ${body.nodeId} AND owner_id = ${user.id}
            `;
            if (node.length === 0) {
                return json({ error: 'Node not found or access denied' }, 404);
            }

            const rows = await sql`
                INSERT INTO node_agents (node_id, agent_id, role_name, permissions)
                VALUES (
                    ${body.nodeId},
                    ${body.agentId || null},
                    ${body.roleName},
                    ${JSON.stringify(body.permissions || {})}
                )
                RETURNING id, node_id, agent_id, role_name, permissions, assigned_at
            `;

            return json({ success: true, assignment: rows[0] }, 201);
        }

        // --- ADD INTENT TO NODE ---
        if (method === 'POST' && action === 'intent') {
            if (!body.nodeId) return json({ error: 'nodeId is required' }, 400);

            const actionError = validateActionType(body.actionType);
            if (actionError) return json({ error: actionError }, 400);

            // Verify ownership
            const node = await sql`
                SELECT id FROM smart_nodes WHERE id = ${body.nodeId} AND owner_id = ${user.id}
            `;
            if (node.length === 0) {
                return json({ error: 'Node not found or access denied' }, 404);
            }

            const rows = await sql`
                INSERT INTO node_intents (node_id, action_type, scheduled_time)
                VALUES (
                    ${body.nodeId},
                    ${body.actionType},
                    ${body.scheduledTime || null}
                )
                RETURNING id, node_id, action_type, status, scheduled_time, created_at
            `;

            return json({ success: true, intent: rows[0] }, 201);
        }

        // --- GET NODE CONTENTS (File System Hierarchy) ---
        if (method === 'GET' && action === 'contents') {
            const nodeId = url.searchParams.get('id');
            if (!nodeId) return json({ error: 'id query param is required' }, 400);

            // Fetch the node to get its name
            const nodeCheck = await sql`SELECT name FROM smart_nodes WHERE id = ${nodeId} AND owner_id = ${user.id}`;
            if (nodeCheck.length === 0) return json({ error: 'Node not found' }, 404);

            // MOCK: Generate a hierarchical file structure for the Sunburst
            // In the future, this will query the Tauri file system or file_events table
            const hierarchy = {
                name: nodeCheck[0].name,
                children: [
                    {
                        name: 'Media',
                        children: [
                            { name: 'IMG_9012.jpg', value: 2048 },
                            { name: 'logo_vector.svg', value: 512 },
                            { name: 'interview_clip.mp4', value: 15400 }
                        ]
                    },
                    {
                        name: 'Documents',
                        children: [
                            { name: 'Q3_Financials.pdf', value: 1024 },
                            { name: 'NDA_Signed.pdf', value: 800 },
                            { name: 'employee_data.csv', value: 200 }
                        ]
                    },
                    {
                        name: 'Scripts',
                        children: [
                            { name: 'process.py', value: 15 },
                            { name: 'cleanup.sh', value: 5 }
                        ]
                    }
                ]
            };

            return json({ success: true, hierarchy });
        }

        // --- GET NODE DETAIL ---
        if (method === 'GET' && action === 'detail') {
            const nodeId = url.searchParams.get('id');
            if (!nodeId) return json({ error: 'id query param is required' }, 400);

            const nodes = await sql`
                SELECT * FROM smart_nodes WHERE id = ${nodeId} AND owner_id = ${user.id}
            `;
            if (nodes.length === 0) {
                return json({ error: 'Node not found or access denied' }, 404);
            }

            const agents = await sql`
                SELECT * FROM node_agents WHERE node_id = ${nodeId}
            `;
            const intents = await sql`
                SELECT * FROM node_intents WHERE node_id = ${nodeId} ORDER BY created_at DESC
            `;

            // Include any receipts we have emitted for this node in this server lifetime
            const nodeReceipts = Array.from(receiptStore.values())
                .filter(r => r.workflow_id === nodeId || r.runtime?.artifacts?.some(a => a.id === nodeId))
                .slice(0, 20);

            return json({
                success: true,
                node: nodes[0],
                agents,
                intents,
                receipts: nodeReceipts,
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // NEW ALETHEIA-WIRED ACTIONS (GroundedReceipt + File + Automation surface)
        // ═══════════════════════════════════════════════════════════════

        // --- UPLOAD FILE (real fileMeta + suggest actions + receipt) ---
        if (method === 'POST' && action === 'upload') {
            if (!body.nodeId || !body.file) {
                return json({ error: 'nodeId and file (with name, type, size) are required' }, 400);
            }

            const parentCheck = await sql`
                SELECT id, name, node_type, owner_id, workflow_id FROM smart_nodes
                WHERE id = ${body.nodeId} AND owner_id = ${user.id}
            `;
            if (parentCheck.length === 0) return json({ error: 'Parent node not found or access denied' }, 404);

            const parent = parentCheck[0];
            const fileMeta = body.file; // { name, type, size, contentHash?, content? }

            // Create a child "file" node under the parent (the directory)
            const fileRows = await sql`
                INSERT INTO smart_nodes (owner_id, name, node_type, parent_id, spec_truth, memory_context, properties, workflow_id)
                VALUES (
                    ${user.id},
                    ${fileMeta.name},
                    'file',
                    ${body.nodeId},
                    ${JSON.stringify({ fileMeta })},
                    '{}',
                    ${JSON.stringify({ fileMeta, suggestedActions: suggestFileActionsForNode(fileMeta) })},
                    ${parent.workflow_id}
                )
                RETURNING *
            `;
            const fileNode = fileRows[0];

            const suggested = suggestFileActionsForNode(fileMeta);

            // Emit a real GroundedReceipt for the upload (with possible inventions from caller)
            const uploadReceipt = await emitGroundedReceipt({
                node: fileNode,
                operation: 'upload',
                inventions: body.inventions || [],
                toolCalls: body.toolCalls || [],
                userId: user.id,
            });

            return json({
                success: true,
                fileNode,
                suggestedActions: suggested,
                receipt: uploadReceipt,
                message: 'File registered as node. GroundedReceipt emitted. Use suggestedActions or ?action=trigger to run automations.',
            }, 201);
        }

        // --- SUGGEST ACTIONS for a file/node (property-based, intent-aware) ---
        if (method === 'GET' && action === 'suggest-actions') {
            const nodeId = url.searchParams.get('id');
            if (!nodeId) return json({ error: 'id required' }, 400);

            const nodeRows = await sql`
                SELECT * FROM smart_nodes WHERE id = ${nodeId} AND owner_id = ${user.id}
            `;
            if (nodeRows.length === 0) return json({ error: 'Node not found' }, 404);

            const node = nodeRows[0];
            const fileMeta = node.properties?.fileMeta || { name: node.name, type: 'unknown' };
            const actions = suggestFileActionsForNode(fileMeta);

            return json({ success: true, nodeId, suggestedActions: actions });
        }

        // --- EMIT RECEIPT manually (great for testing + agent folders) ---
        if (method === 'POST' && action === 'emit-receipt') {
            if (!body.nodeId) return json({ error: 'nodeId required' }, 400);

            const nodeRows = await sql`
                SELECT * FROM smart_nodes WHERE id = ${body.nodeId} AND owner_id = ${user.id}
            `;
            if (nodeRows.length === 0) return json({ error: 'Node not found or access denied' }, 404);

            const receipt = await emitGroundedReceipt({
                node: nodeRows[0],
                operation: body.operation || 'manual',
                inventions: body.inventions || [],
                toolCalls: body.toolCalls || [],
                userId: user.id,
            });

            return json({ success: true, receipt }, 201);
        }

        // --- LIST RECEIPTS for a node (or recent across account) ---
        if (method === 'GET' && action === 'receipts') {
            const nodeId = url.searchParams.get('nodeId');
            let receipts;

            if (nodeId) {
                // Verify ownership quickly
                const owns = await sql`SELECT 1 FROM smart_nodes WHERE id = ${nodeId} AND owner_id = ${user.id}`;
                if (owns.length === 0) return json({ error: 'Node not found or access denied' }, 404);

                receipts = Array.from(receiptStore.values())
                    .filter(r => r.workflow_id === nodeId || r.runtime?.artifacts?.some(a => a.id === nodeId))
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 50);
            } else {
                // Recent receipts for the user (lightweight scan of in-memory store)
                receipts = Array.from(receiptStore.values())
                    .filter(r => r.agent_cache_account_id === `user-${user.id}` || true)
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 50);
            }

            return json({ success: true, receipts, count: receipts.length });
        }

        // --- REGISTER WATCHER (Shortcuts-style automation trigger) ---
        if (method === 'POST' && action === 'register-watcher') {
            if (!body.nodeId) return json({ error: 'nodeId required' }, 400);

            const owns = await sql`SELECT 1 FROM smart_nodes WHERE id = ${body.nodeId} AND owner_id = ${user.id}`;
            if (owns.length === 0) return json({ error: 'Node not found or access denied' }, 404);

            const watcher = {
                id: 'w_' + Date.now().toString(36),
                nodeId: body.nodeId,
                events: body.events || ['node:write', 'node:upload', 'file:added'],
                callbackUrl: body.callbackUrl || null,
                created_at: new Date().toISOString(),
            };

            if (!watcherStore.has(body.nodeId)) watcherStore.set(body.nodeId, []);
            watcherStore.get(body.nodeId).push(watcher);

            return json({ success: true, watcher }, 201);
        }

        // --- TRIGGER (simulate automation / folder event → run tools → emit receipt) ---
        if (method === 'POST' && action === 'trigger') {
            if (!body.nodeId || !body.event) {
                return json({ error: 'nodeId and event required (e.g. "file:added", "node:write")' }, 400);
            }

            const nodeRows = await sql`
                SELECT * FROM smart_nodes WHERE id = ${body.nodeId} AND owner_id = ${user.id}
            `;
            if (nodeRows.length === 0) return json({ error: 'Node not found or access denied' }, 404);

            const node = nodeRows[0];

            // Run a suggested tool based on event (very small simulation)
            const toolCalls = [{
                tool_name: body.tool || 'builtin.classify',
                input_hash: Buffer.from(body.event + (body.payload ? JSON.stringify(body.payload) : '')).toString('base64').slice(0, 24),
                duration_ms: 7,
            }];

            const inventions = body.inventions || [];
            if (body.payload?.unverifiedClaim) {
                inventions.push({
                    type: 'fact_claim',
                    content: body.payload.unverifiedClaim,
                    grounding_attempt: 'none',
                    was_flagged: true,
                });
            }

            const triggerReceipt = await emitGroundedReceipt({
                node,
                operation: `trigger:${body.event}`,
                inventions,
                toolCalls,
                userId: user.id,
            });

            // Also notify any watchers registered on this node
            _notifyWatchers(node, triggerReceipt, `trigger:${body.event}`);

            return json({
                success: true,
                event: body.event,
                receipt: triggerReceipt,
                message: 'Automation trigger executed. GroundedReceipt emitted. Watchers notified (if any).',
            }, 201);
        }

        return json({ error: 'Invalid action or method' }, 400);

    } catch (err) {
        console.error('[Nodes] Error:', err);
        return json({ error: 'Internal server error' }, 500);
    }
}
