export const config = { runtime: 'nodejs' };

import { getAuditLogs, convertToCSV, getAuditStats } from '../lib/audit.js';

const getEnv = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
  const { url, token } = getEnv();
  if (!url || !token) throw new Error('Upstash not configured');
  const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
  const res = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  return data.result;
}

/**
 * Admin Audit Export API
 * 
 * GET /api/admin/audit-export?start_date=2025-01-01&end_date=2025-01-31&format=csv
 * 
 * Requires ADMIN_TOKEN in Authorization header
 */
export default async function handler(req) {
  try {
    // Verify admin authorization
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const namespace = url.searchParams.get('namespace');
    const eventType = url.searchParams.get('event_type');
    const format = url.searchParams.get('format') || 'csv';
    const mode = url.searchParams.get('mode') || 'export'; // 'export' | 'stats'

    // Validate date range
    if (!startDate) {
      return new Response(JSON.stringify({ 
        error: 'start_date parameter is required',
        example: '/api/admin/audit-export?start_date=2025-01-01&end_date=2025-01-31'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Mode: Statistics
    if (mode === 'stats') {
      const stats = await getAuditStats(redis, { start_date: startDate, end_date: endDate });
      
      return new Response(JSON.stringify(stats, null, 2), {
        status: 200,
        headers: { 
          'content-type': 'application/json',
          'cache-control': 'no-store'
        }
      });
    }

    // Mode: Export
    const filters = {
      start_date: startDate,
      end_date: endDate,
      namespace,
      event_type: eventType,
      limit: 10000 // Max export size
    };

    const logs = await getAuditLogs(redis, filters);

    if (logs.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No audit logs found for the specified date range',
        filters
      }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Format: CSV (default for compliance teams)
    if (format === 'csv') {
      const csv = convertToCSV(logs);
      const filename = `audit-${startDate}-to-${endDate || 'now'}.csv`;
      
      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}"`,
          'cache-control': 'no-store'
        }
      });
    }

    // Format: JSON
    if (format === 'json') {
      return new Response(JSON.stringify({ 
        count: logs.length,
        filters,
        logs
      }, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store'
        }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Invalid format. Supported formats: csv, json' 
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });

  } catch (error) {
    console.error('Audit export error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
