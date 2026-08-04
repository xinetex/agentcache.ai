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
        const user = await getUserFromRequest(req);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        if (req.method === 'POST') {
            const { nodeIds } = await req.json();
            if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
                return json({ success: true, telemetry: {} });
            }

            // Verify ownership
            const validNodes = await sql`
                SELECT id FROM smart_nodes 
                WHERE owner_id = ${user.id} AND id = ANY(${nodeIds}::uuid[])
            `;
            const validNodeIds = validNodes.map(n => n.id);

            if (validNodeIds.length === 0) {
                return json({ success: true, telemetry: {} });
            }

            // Get file composition (Count of file types per node)
            const composition = await sql`
                SELECT node_id, file_type, COUNT(*) as count
                FROM file_events
                WHERE node_id = ANY(${validNodeIds}::uuid[])
                GROUP BY node_id, file_type
            `;

            // Get activity sparkline (Count of files processed per hour over the last 12 hours)
            // For MVP simplicity, we just count events per node created in the last 12 intervals
            const activity = await sql`
                SELECT 
                    node_id, 
                    date_trunc('hour', created_at) as hour, 
                    COUNT(*) as count
                FROM file_events
                WHERE node_id = ANY(${validNodeIds}::uuid[])
                  AND created_at >= NOW() - INTERVAL '12 hours'
                GROUP BY node_id, hour
                ORDER BY hour ASC
            `;

            const telemetry = {};
            for (const id of validNodeIds) {
                telemetry[id] = { composition: [], activity: [], dials: {} };
            }

            for (const row of composition) {
                telemetry[row.node_id].composition.push({ type: row.file_type || 'unknown', count: parseInt(row.count) });
            }

            // Group activity into a simple array of counts for the sparkline [0, 5, 2, ...]
            const groupedActivity = {};
            for (const row of activity) {
                if (!groupedActivity[row.node_id]) groupedActivity[row.node_id] = [];
                groupedActivity[row.node_id].push(parseInt(row.count));
            }
            for (const id of validNodeIds) {
                telemetry[id].activity = groupedActivity[id] || [0, 0, 0, 0, 0, 0];
            }

            // === Aletheia agentic dials (heartbeats, souls, skills, drift, receipts) ===
            // Placeholders + computed values ready for the RSVPuix metric panels.
            // In a fuller wiring these would come from heartbeats table, soul registry,
            // skill manifests, and the grounded_receipts / receiptStore.
            for (const id of validNodeIds) {
                const receiptCount = 0; // could scan receiptStore in a shared module
                telemetry[id].dials = {
                    heartbeat_age_sec: Math.floor(Math.random() * 300) + 30,
                    souls: Math.floor(Math.random() * 4) + 1,
                    skills: ['classify', 'summarize', 'notify'].slice(0, Math.floor(Math.random() * 3) + 1),
                    drift_score: parseFloat((Math.random() * 0.18).toFixed(3)),
                    invention_count: Math.floor(Math.random() * 3),
                    receipt_count: receiptCount,
                    last_grounded_at: new Date(Date.now() - Math.random() * 3600 * 1000).toISOString(),
                    markup_files: Math.floor(Math.random() * 7),
                };
            }

            return json({ success: true, telemetry });
        }

        return json({ error: 'Invalid method' }, 405);
    } catch (err) {
        console.error('[Telemetry API] Error:', err);
        return json({ error: 'Internal server error' }, 500);
    }
}
