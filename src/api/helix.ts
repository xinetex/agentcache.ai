/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { Hono } from 'hono';
import { alignmentMapService } from '../services/AlignmentMapService.js';
import { HelixEngine } from '../services/HelixEngine.js';

const helix = new Hono();

/**
 * POST /api/helix/infer
 * Sub-second Private AI Inference using linear alignment.
 */
helix.post('/infer', async (c) => {
    try {
        const body = await c.req.json();
        const { aligned_representation, source_model, target_model } = body;

        if (!aligned_representation || !source_model || !target_model) {
            return c.json({ error: 'Missing alignment parameters' }, 400);
        }

        // 1. Resolve alignment map
        const map = await alignmentMapService.getMap(source_model, target_model);
        if (!map) {
            return c.json({ error: 'Model alignment map not found' }, 404);
        }

        // 2. Apply the alignment transformation
        const startTime = Date.now();
        const transformedRepresentation = HelixEngine.transform(aligned_representation, map.matrix);

        return c.json({
            success: true,
            transformed: transformedRepresentation,
            latency_ms: Date.now() - startTime,
            aligned: true,
            source_model,
            target_model,
            message: "Private inference successful via HELIX linear alignment."
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * GET /api/helix/sync
 * Fetch the latest alignment map for a model pair.
 */
helix.get('/sync', async (c) => {
    const source = c.req.query('source');
    const target = c.req.query('target');

    if (!source || !target) {
        return c.json({ error: 'Query parameters source/target required' }, 400);
    }

    const map = await alignmentMapService.getMap(source, target);
    if (!map) {
        return c.json({ error: 'Map not found' }, 404);
    }

    return c.json(map);
});

export default helix;
