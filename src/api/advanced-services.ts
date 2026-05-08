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
import { z } from 'zod';
import {
  advancedServicesService,
  type AdvancedServicesBlueprintInput,
} from '../services/AdvancedServicesService.js';

const advancedServicesRouter = new Hono();

const blueprintSchema = z.object({
  objective: z.string().min(1).max(4000),
  sector: z.string().max(80).optional(),
  autonomy: z.enum(['shadow', 'copilot', 'autonomous']).optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  systems: z.array(z.string().min(1).max(120)).max(20).optional(),
  painPoints: z.array(z.string().min(1).max(180)).max(20).optional(),
  currentStack: z.array(z.string().min(1).max(120)).max(20).optional(),
  regulated: z.boolean().optional(),
});

advancedServicesRouter.get('/', (c) => {
  return c.json({
    success: true,
    service: 'advanced-services',
    thesis: 'Workflow Memory Fabric plus Reliability Mesh plus DecisionRail is the product stack for enterprise agent adoption.',
    endpoints: [
      'GET /api/advanced-services/catalog',
      'GET /api/advanced-services/:id',
      'POST /api/advanced-services/blueprint',
    ],
  });
});

advancedServicesRouter.get('/catalog', (c) => {
  return c.json({
    success: true,
    services: advancedServicesService.getCatalog(),
  });
});

advancedServicesRouter.get('/:id', (c) => {
  const service = advancedServicesService.getService(c.req.param('id'));
  if (!service) {
    return c.json({ error: 'Advanced service not found.' }, 404);
  }

  return c.json({ success: true, service });
});

advancedServicesRouter.post('/blueprint', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = blueprintSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
    }

    const blueprint = advancedServicesService.buildBlueprint(parsed.data as AdvancedServicesBlueprintInput);
    return c.json({ success: true, blueprint }, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to build advanced services blueprint.' }, 500);
  }
});

export default advancedServicesRouter;
