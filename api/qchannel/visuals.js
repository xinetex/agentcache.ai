import { db } from '../../lib/db.js';

export default async function handler(req) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean); // /api/qchannel/visuals

    try {
        if (req.method === 'GET') {
            const type = url.searchParams.get('type') || 'background';
            const limit = parseInt(url.searchParams.get('limit') || '10');
            const random = url.searchParams.get('random') === 'true';

            let query = `
                SELECT * FROM qchannel_visuals 
                WHERE is_active = true AND type = $1
            `;

            if (random) {
                query += ` ORDER BY RANDOM()`;
            } else {
                query += ` ORDER BY created_at DESC`;
            }

            query += ` LIMIT $2`;

            const result = await db.query(query, [type, limit]);

            return new Response(JSON.stringify({
                count: result.rows.length,
                items: result.rows
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (req.method === 'POST') {
            const body = await req.json();
            const { url, type, title, artist, metadata } = body;

            if (!url) {
                return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 });
            }

            const result = await db.query(`
                INSERT INTO qchannel_visuals (url, type, title, artist, metadata)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [url, type || 'background', title, artist, metadata || {}]);

            return new Response(JSON.stringify(result.rows[0]), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    } catch (error) {
        console.error('[QChannel Visuals] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
