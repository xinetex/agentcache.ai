/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * Compliance API: B2B interface for Compliance Sovereign Swarms.
 * Phase 8: Scaling the B2B Sentient Economy.
 */

import { Hono } from 'hono';
import { complianceSwarmOrchestrator, AuditorAgent } from '../services/ComplianceSwarmOrchestrator.js';
import { sectorSolutionOrchestrator, SectorType } from '../services/SectorSolutionOrchestrator.js';
import { agentRegistry, extractApiKey } from '../lib/hub/registry.js';

const complianceRouter = new Hono();

/**
 * GET /api/compliance/stats
 * Get real-time stats about the auditor swarm.
 */
complianceRouter.get('/stats', async (c) => {
    const stats = await complianceSwarmOrchestrator.getSwarmStats();
    return c.json({
        success: true,
        stats
    });
});

/**
 * POST /api/compliance/solutions/spawn
 * Spawn a specialized sector solution agent.
 */
complianceRouter.post('/solutions/spawn', async (c) => {
    const apiKey = extractApiKey(c.req.header('Authorization'));
    if (!apiKey) return c.json({ error: 'Authorization required' }, 401);

    const agent = await agentRegistry.getByApiKey(apiKey);
    if (!agent) return c.json({ error: 'Invalid API key' }, 401);

    const body = await c.req.json();
    const { sector } = body;

    if (!sector) return c.json({ error: 'Missing sector' }, 400);

    console.log(`[ComplianceAPI] 🚀 Agent ${agent.id} is spawning a ${sector} solution.`);

    const solution = await sectorSolutionOrchestrator.spawnSectorAgent(sector as SectorType);

    return c.json({
        success: true,
        solution,
        message: `Specialized ${sector} solution agent ${solution.name} spawned. B2B fees apply.`
    });
});

/**
 * GET /api/compliance/solutions/active
 * Get all active sector solutions.
 */
complianceRouter.get('/solutions/active', async (c) => {
    const solutions = await sectorSolutionOrchestrator.getActiveSolutions();
    return c.json({
        success: true,
        count: solutions.length,
        solutions
    });
});

/**
 * POST /api/compliance/lease
 * Lease a compliance auditor for a specific deal.
 */
complianceRouter.post('/lease', async (c) => {
    const apiKey = extractApiKey(c.req.header('Authorization'));
    if (!apiKey) return c.json({ error: 'Authorization required' }, 401);

    const agent = await agentRegistry.getByApiKey(apiKey);
    if (!agent) return c.json({ error: 'Invalid API key' }, 401);

    const body = await c.req.json();
    const { dealId, specialization } = body;

    if (!dealId) return c.json({ error: 'Missing dealId' }, 400);

    console.log(`[ComplianceAPI] 🕵️ Agent ${agent.id} is leasing a ${specialization || 'FINANCIAL'} auditor for deal ${dealId}`);

    const auditor = await complianceSwarmOrchestrator.assignAuditor(dealId, specialization);

    if (!auditor) {
        return c.json({ error: 'No auditors available' }, 503);
    }

    return c.json({
        success: true,
        auditor: {
            id: auditor.id,
            name: auditor.name,
            specialization: auditor.specialization
        },
        message: `Auditor ${auditor.name} is now monitoring deal ${dealId}. Compliance fees apply.`
    });
});

/**
 * POST /api/compliance/release
 * Release an auditor from a finished deal.
 */
complianceRouter.post('/release', async (c) => {
    const apiKey = extractApiKey(c.req.header('Authorization'));
    if (!apiKey) return c.json({ error: 'Authorization required' }, 401);

    const agent = await agentRegistry.getByApiKey(apiKey);
    if (!agent) return c.json({ error: 'Invalid API key' }, 401);

    const body = await c.req.json();
    const { auditorId } = body;

    if (!auditorId) return c.json({ error: 'Missing auditorId' }, 400);

    await complianceSwarmOrchestrator.releaseAuditor(auditorId);

    return c.json({
        success: true,
        message: `Auditor ${auditorId} released back to pool.`
    });
});

export default complianceRouter;
