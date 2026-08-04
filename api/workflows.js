/**
 * Workflow & Connection API — AgentForge
 * CRUD for workflows (canvases) and node connections (edges/wires).
 * Enables the n8n-style visual node editor.
 */
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from './auth.js';

export const config = { runtime: 'nodejs' };

const sql = neon(process.env.DATABASE_URL);

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

export default async function handler(req) {
    try {
        const url = new URL(req.url);
        const action = url.searchParams.get('action');
        const method = req.method;

        const user = await getUserFromRequest(req);
        if (!user) return json({ error: 'Authentication required' }, 401);

        const body = (method === 'POST' || method === 'PATCH' || method === 'DELETE')
            ? await req.json()
            : {};

        // ═══════════════════════════════════════
        // WORKFLOWS (Canvases)
        // ═══════════════════════════════════════

        // --- List workflows ---
        if (method === 'GET' && !action) {
            const workflows = await sql`
                SELECT w.*,
                    (SELECT COUNT(*) FROM smart_nodes sn WHERE sn.workflow_id = w.id) as node_count,
                    (SELECT COUNT(*) FROM node_connections nc WHERE nc.workflow_id = w.id) as connection_count
                FROM workflows w
                WHERE w.owner_id = ${user.id}
                ORDER BY w.updated_at DESC
                LIMIT 50
            `;
            return json({ success: true, workflows });
        }

        // --- Create workflow ---
        if (method === 'POST' && action === 'create') {
            if (!body.name) return json({ error: 'name is required' }, 400);

            const rows = await sql`
                INSERT INTO workflows (owner_id, name, description, settings)
                VALUES (${user.id}, ${body.name}, ${body.description || null}, ${JSON.stringify(body.settings || {})})
                RETURNING *
            `;
            return json({ success: true, workflow: rows[0] }, 201);
        }

        // --- Get workflow with all nodes and connections ---
        if (method === 'GET' && action === 'detail') {
            const workflowId = url.searchParams.get('id');
            if (!workflowId) return json({ error: 'id is required' }, 400);

            const wf = await sql`
                SELECT * FROM workflows WHERE id = ${workflowId} AND owner_id = ${user.id}
            `;
            if (wf.length === 0) return json({ error: 'Workflow not found' }, 404);

            const nodes = await sql`
                SELECT * FROM smart_nodes WHERE workflow_id = ${workflowId} ORDER BY created_at
            `;
            const connections = await sql`
                SELECT * FROM node_connections WHERE workflow_id = ${workflowId}
            `;

            return json({
                success: true,
                workflow: wf[0],
                nodes,
                connections,
            });
        }

        // --- Update workflow ---
        if (method === 'PATCH' && action === 'update') {
            if (!body.workflowId) return json({ error: 'workflowId is required' }, 400);

            const rows = await sql`
                UPDATE workflows
                SET name = COALESCE(${body.name || null}, name),
                    description = COALESCE(${body.description || null}, description),
                    status = COALESCE(${body.status || null}, status),
                    settings = COALESCE(${body.settings ? JSON.stringify(body.settings) : null}::jsonb, settings),
                    updated_at = NOW()
                WHERE id = ${body.workflowId} AND owner_id = ${user.id}
                RETURNING *
            `;
            if (rows.length === 0) return json({ error: 'Workflow not found' }, 404);

            return json({ success: true, workflow: rows[0] });
        }

        // --- Delete workflow (cascades nodes + connections) ---
        if (method === 'POST' && action === 'delete') {
            if (!body.workflowId) return json({ error: 'workflowId is required' }, 400);

            // Cascade: connections → intents → agents → nodes → workflow
            await sql`DELETE FROM node_connections WHERE workflow_id = ${body.workflowId}`;
            const nodeIds = await sql`SELECT id FROM smart_nodes WHERE workflow_id = ${body.workflowId}`;
            for (const n of nodeIds) {
                await sql`DELETE FROM node_intents WHERE node_id = ${n.id}`;
                await sql`DELETE FROM node_agents WHERE node_id = ${n.id}`;
                await sql`DELETE FROM node_properties WHERE node_id = ${n.id}`;
            }
            await sql`DELETE FROM smart_nodes WHERE workflow_id = ${body.workflowId}`;
            await sql`DELETE FROM workflow_executions WHERE workflow_id = ${body.workflowId}`;
            const rows = await sql`
                DELETE FROM workflows WHERE id = ${body.workflowId} AND owner_id = ${user.id}
                RETURNING id
            `;
            if (rows.length === 0) return json({ error: 'Workflow not found' }, 404);

            return json({ success: true, deleted: body.workflowId });
        }

        // ═══════════════════════════════════════
        // CONNECTIONS (Edges / Wires)
        // ═══════════════════════════════════════

        // --- Create connection ---
        if (method === 'POST' && action === 'connect') {
            const { workflowId, sourceNodeId, targetNodeId, sourcePort, targetPort, dataMapping, condition } = body;

            if (!workflowId || !sourceNodeId || !targetNodeId) {
                return json({ error: 'workflowId, sourceNodeId, and targetNodeId are required' }, 400);
            }

            // Prevent self-loops
            if (sourceNodeId === targetNodeId) {
                return json({ error: 'Cannot connect a node to itself' }, 400);
            }

            // Verify both nodes exist in this workflow and belong to user
            const nodeCheck = await sql`
                SELECT id FROM smart_nodes
                WHERE workflow_id = ${workflowId}
                  AND id IN (${sourceNodeId}, ${targetNodeId})
            `;
            if (nodeCheck.length < 2) {
                return json({ error: 'One or both nodes not found in this workflow' }, 404);
            }

            // Prevent duplicate connections (same source+target+ports)
            const existing = await sql`
                SELECT id FROM node_connections
                WHERE source_node_id = ${sourceNodeId}
                  AND target_node_id = ${targetNodeId}
                  AND source_port = ${sourcePort || 'output'}
                  AND target_port = ${targetPort || 'input'}
            `;
            if (existing.length > 0) {
                return json({ error: 'Connection already exists' }, 409);
            }

            const rows = await sql`
                INSERT INTO node_connections (
                    workflow_id, source_node_id, target_node_id,
                    source_port, target_port, data_mapping, condition
                )
                VALUES (
                    ${workflowId}, ${sourceNodeId}, ${targetNodeId},
                    ${sourcePort || 'output'}, ${targetPort || 'input'},
                    ${JSON.stringify(dataMapping || {})},
                    ${condition ? JSON.stringify(condition) : null}
                )
                RETURNING *
            `;
            return json({ success: true, connection: rows[0] }, 201);
        }

        // --- Delete connection ---
        if (method === 'POST' && action === 'disconnect') {
            if (!body.connectionId) return json({ error: 'connectionId is required' }, 400);

            const rows = await sql`
                DELETE FROM node_connections WHERE id = ${body.connectionId}
                RETURNING id
            `;
            if (rows.length === 0) return json({ error: 'Connection not found' }, 404);

            return json({ success: true, deleted: body.connectionId });
        }

        // --- Batch update node positions (drag on canvas) ---
        if (method === 'POST' && action === 'positions') {
            if (!body.positions || !Array.isArray(body.positions)) {
                return json({ error: 'positions array is required' }, 400);
            }

            for (const pos of body.positions) {
                if (!pos.nodeId || pos.x === undefined || pos.y === undefined) continue;
                await sql`
                    UPDATE smart_nodes
                    SET pos_x = ${pos.x}, pos_y = ${pos.y}, updated_at = NOW()
                    WHERE id = ${pos.nodeId}
                `;
            }

            return json({ success: true, updated: body.positions.length });
        }

        return json({ error: 'Invalid action' }, 400);

    } catch (err) {
        console.error('[Workflows] Error:', err);
        return json({ error: 'Internal server error' }, 500);
    }
}
