/**
 * QChannel Analytics
 * POST /api/qchannel/analytics/view - Log content view
 * GET /api/qchannel/analytics/summary - Get analytics summary (admin)
 */

import { db } from '../../lib/db.js';

export default async function handler(req) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[3]; // 'view' or 'summary'

    try {
        if (action === 'view' && req.method === 'POST') {
            return await logView(await req.json());
        }

        if (action === 'summary' && req.method === 'GET') {
            return await getSummary(url.searchParams);
        }

        return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[QChannel Analytics] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function logView(data) {
    const { zone_id, content_type, content_id, device_type, device_id, view_duration_seconds } = data;

    await db.query(`
    INSERT INTO qchannel_analytics 
      (zone_id, content_type, content_id, device_type, device_id, view_duration_seconds, date)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
  `, [
        zone_id || null,
        content_type || 'zone',
        content_id || null,
        device_type || 'unknown',
        device_id || null,
        view_duration_seconds || 0
    ]);

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function getSummary(params) {
    const days = parseInt(params.get('days') || '7', 10);
    const zoneId = params.get('zone_id');

    // Overall stats
    let statsQuery = `
    SELECT 
      COUNT(*) as total_views,
      COUNT(DISTINCT device_id) as unique_devices,
      SUM(view_duration_seconds) as total_view_seconds,
      COUNT(DISTINCT zone_id) as zones_viewed
    FROM qchannel_analytics
    WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
  `;

    if (zoneId) {
        statsQuery += ` AND zone_id = '${zoneId}'`;
    }

    const statsResult = await db.query(statsQuery);

    // Views by zone
    const byZoneResult = await db.query(`
    SELECT 
      z.name as zone_name,
      z.slug as zone_slug,
      COUNT(*) as views,
      SUM(a.view_duration_seconds) as total_seconds
    FROM qchannel_analytics a
    LEFT JOIN qchannel_zones z ON a.zone_id = z.id
    WHERE a.date >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY z.id, z.name, z.slug
    ORDER BY views DESC
  `);

    // Views by device type
    const byDeviceResult = await db.query(`
    SELECT 
      device_type,
      COUNT(*) as views
    FROM qchannel_analytics
    WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY device_type
    ORDER BY views DESC
  `);

    // Daily trend
    const trendResult = await db.query(`
    SELECT 
      date,
      COUNT(*) as views
    FROM qchannel_analytics
    WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY date
    ORDER BY date ASC
  `);

    return new Response(JSON.stringify({
        period_days: days,
        stats: statsResult.rows[0],
        by_zone: byZoneResult.rows,
        by_device: byDeviceResult.rows,
        daily_trend: trendResult.rows,
        timestamp: Date.now()
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=60'
        }
    });
}
