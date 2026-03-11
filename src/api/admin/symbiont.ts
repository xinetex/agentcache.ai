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
import { symbiontBridge, ContractDraftConfig } from '../../services/SymbiontBridge.js';
import { db } from '../../db/client.js';
import { legalContracts } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const symbiontAdminRouter = new Hono();

/**
 * GET /api/admin/symbiont/templates
 * List available legal templates from the Symbiont repo.
 */
symbiontAdminRouter.get('/templates', async (c) => {
    try {
        const templates = await symbiontBridge.listTemplates();
        return c.json({ templates });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * GET /api/admin/symbiont/contracts
 * List all generated legal contracts.
 */
symbiontAdminRouter.get('/contracts', async (c) => {
    try {
        const contracts = await db.select()
            .from(legalContracts)
            .orderBy(desc(legalContracts.createdAt));
        return c.json({ contracts });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * POST /api/admin/symbiont/draft
 * Create a new draft contract for a swarm.
 */
symbiontAdminRouter.post('/draft', async (c) => {
    try {
        const config = await c.req.json() as ContractDraftConfig;
        if (!config.swarmId || !config.templateId) {
            return c.json({ error: 'swarmId and templateId required' }, 400);
        }

        const contract = await symbiontBridge.draftContract(config);
        return c.json({ success: true, contract });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * GET /api/admin/symbiont/contracts/:id
 * Get details of a specific contract.
 */
symbiontAdminRouter.get('/contracts/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const rows = await db.select().from(legalContracts).where(eq(legalContracts.id, id as any)).limit(1);
        if (rows.length === 0) return c.json({ error: 'Contract not found' }, 404);
        return c.json({ success: true, contract: rows[0] });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export { symbiontAdminRouter };
