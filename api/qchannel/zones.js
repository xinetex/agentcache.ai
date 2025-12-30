/**
 * QChannel Zones API
 * GET /api/qchannel/zones - List all active zones
 * GET /api/qchannel/zones/:id - Get single zone
 * POST /api/qchannel/zones - Create zone (admin)
 * PATCH /api/qchannel/zones/:id - Update zone (admin)
 * DELETE /api/qchannel/zones/:id - Delete zone (admin)
 */

import { db } from '../../lib/db.js';

export default async function handler(req) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const zoneId = pathParts[3]; // /api/qchannel/zones/:id

    try {
        switch (req.method) {
            case 'GET':
                if (zoneId) {
                    return await getZone(zoneId);
                }
                return await listZones(url.searchParams);

            case 'POST':
                return await createZone(await req.json());

            case 'PATCH':
                if (!zoneId) {
                    return new Response(JSON.stringify({ error: 'Zone ID required' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return await updateZone(zoneId, await req.json());

            case 'DELETE':
                if (!zoneId) {
                    return new Response(JSON.stringify({ error: 'Zone ID required' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return await deleteZone(zoneId);

            default:
                return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                    status: 405,
                    headers: { 'Content-Type': 'application/json' }
                });
        }
    } catch (error) {
        console.error('[QChannel Zones] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function listZones(params) {
    const includeInactive = params.get('includeInactive') === 'true';

    let query = `
    SELECT 
      id, name, slug, description, icon, color,
      gradient_from, gradient_to,
      coingecko_category_id, defillama_category,
      sort_order, is_active, is_featured,
      metadata, created_at, updated_at
    FROM qchannel_zones
  `;

    if (!includeInactive) {
        query += ` WHERE is_active = true`;
    }

    query += ` ORDER BY sort_order ASC`;

    const result = await db.query(query);

    return new Response(JSON.stringify({
        data: result.rows,
        count: result.rows.length,
        timestamp: Date.now()
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
    });
}

async function getZone(id) {
    // Support both UUID and slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const query = isUUID
        ? `SELECT * FROM qchannel_zones WHERE id = $1`
        : `SELECT * FROM qchannel_zones WHERE slug = $1`;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Zone not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
        data: result.rows[0],
        timestamp: Date.now()
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
    });
}

async function createZone(data) {
    const { name, slug, description, icon, color, coingecko_category_id, defillama_category } = data;

    if (!name || !slug) {
        return new Response(JSON.stringify({ error: 'Name and slug are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const result = await db.query(`
    INSERT INTO qchannel_zones (name, slug, description, icon, color, coingecko_category_id, defillama_category)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [name, slug, description, icon || 'zap', color || '#00f3ff', coingecko_category_id, defillama_category]);

    return new Response(JSON.stringify({
        data: result.rows[0],
        message: 'Zone created successfully'
    }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function updateZone(id, data) {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'description', 'icon', 'color', 'gradient_from', 'gradient_to',
        'coingecko_category_id', 'defillama_category', 'sort_order', 'is_active', 'is_featured', 'metadata'];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(field === 'metadata' ? JSON.stringify(data[field]) : data[field]);
            paramIndex++;
        }
    }

    if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
    UPDATE qchannel_zones 
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Zone not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
        data: result.rows[0],
        message: 'Zone updated successfully'
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function deleteZone(id) {
    const result = await db.query(`
    DELETE FROM qchannel_zones WHERE id = $1 RETURNING id
  `, [id]);

    if (result.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Zone not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
        message: 'Zone deleted successfully',
        id: result.rows[0].id
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
