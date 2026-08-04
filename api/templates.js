import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from './auth.js';
import { loadActionPacks } from './lib/pack-loader.js';

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
        const user = await getUserFromRequest(req);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        // GET /api/templates — List all available templates (DB + file-based Action Packs)
        if (req.method === 'GET') {
            // 1. Load legacy DB templates (existing behavior)
            const rows = await sql`
                SELECT t.id, t.name, t.description, t.category, t.required_inputs, 
                       p.name as pack_name, p.is_official
                FROM action_templates t
                JOIN sector_packs p ON t.pack_id = p.id
                ORDER BY p.name, t.name
            `;
            
            // Group by pack_name
            const packs = {};
            for (const row of rows) {
                if (!packs[row.pack_name]) packs[row.pack_name] = [];
                packs[row.pack_name].push(row);
            }

            // 2. Load rich file-based Action Packs (the new "Enhanced Automator" content)
            const filePacks = loadActionPacks();
            if (filePacks.length > 0) {
                packs['Action Packs (Filesystem)'] = filePacks.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    category: p.category,
                    version: p.version,
                    icon: p.icon,
                    required_inputs: p.required_inputs || [],
                    pack_name: p.pack?.pack?.suite_name || 'Action Packs',
                    is_official: false,
                    is_file_pack: true,
                    pack: p.pack,                    // full rich definition
                    workflow_schema: p.workflow_schema,
                }));
            }
            
            return json({ packs });
        }

        // POST /api/templates?action=install — "Install" a template or rich Action Pack onto a node
        if (req.method === 'POST') {
            const action = url.searchParams.get('action');
            if (action === 'install') {
                const { templateId, packId, nodeId } = await req.json();
                
                if (!nodeId || (!templateId && !packId)) {
                    return json({ error: 'nodeId and either templateId or packId required' }, 400);
                }

                // Verify user owns the node
                const nodeCheck = await sql`SELECT id FROM smart_nodes WHERE id = ${nodeId} AND owner_id = ${user.id}`;
                if (nodeCheck.length === 0) return json({ error: 'Node not found or unauthorized' }, 404);

                let templateConfig;

                if (packId) {
                    // Install a rich file-based Action Pack
                    const { getPackById } = await import('./lib/pack-loader.js');
                    const packEntry = getPackById(packId);
                    if (!packEntry) return json({ error: 'Pack not found' }, 404);

                    templateConfig = {
                        installedPack: packEntry.name,
                        packId: packEntry.id,
                        pack: packEntry.pack,
                        workflowSchema: packEntry.workflow_schema,
                        installedAt: new Date().toISOString(),
                    };
                } else {
                    // Legacy DB template install
                    const tplCheck = await sql`SELECT * FROM action_templates WHERE id = ${templateId}`;
                    if (tplCheck.length === 0) return json({ error: 'Template not found' }, 404);

                    const tpl = tplCheck[0];
                    templateConfig = {
                        installedTemplate: tpl.name,
                        templateId: tpl.id,
                        requiredInputs: tpl.required_inputs,
                        workflowSchema: tpl.workflow_schema,
                        installedAt: new Date().toISOString(),
                    };
                }

                await sql`
                    UPDATE smart_nodes 
                    SET properties = COALESCE(properties, '{}'::jsonb) || ${JSON.stringify(templateConfig)}::jsonb,
                        node_type = 'template_action',
                        updated_at = NOW()
                    WHERE id = ${nodeId}
                `;

                return json({ 
                    success: true, 
                    message: packId 
                        ? `Installed Action Pack "${templateConfig.installedPack}" to node` 
                        : `Installed ${templateConfig.installedTemplate} to node` 
                });
            }
        }

        return json({ error: 'Not found' }, 404);

    } catch (err) {
        console.error('[Templates API] Error:', err);
        return json({ error: 'Internal server error' }, 500);
    }
}
