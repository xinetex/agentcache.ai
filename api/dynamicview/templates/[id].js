/**
 * Dynamic View Templates API
 * GET /api/dynamicview/templates/[id]
 * 
 * Serves pre-made Dynamic View templates for instant loading
 */

import { getTemplateById } from '../generate.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Template ID required' });
  }

  const template = getTemplateById(id);

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  return res.status(200).json({
    schema: template,
    cached: true,
    latency: 0
  });
}
