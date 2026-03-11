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
import { authenticateApiKey } from '../middleware/auth.js';
import { platformReportService } from '../services/PlatformReportService.js';

const platformRouter = new Hono();

/**
 * Admin guard: Only enterprise tier or x402-paid agents can access platform reports.
 */
async function requireAdmin(c: any) {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const tier = c.get('tier');
    if (tier !== 'enterprise' && tier !== 'x402-paid') {
        return c.json({
            error: 'Admin access required',
            requiredTier: 'enterprise',
            currentTier: tier,
        }, 403);
    }
    return null;
}

// ─────────────────────────────────────────────
//  GET /api/platform/report
//  Full platform report — revenue, agents, credits, usage, ontology
// ─────────────────────────────────────────────
platformRouter.get('/report', async (c) => {
    const authError = await requireAdmin(c);
    if (authError) return authError;

    try {
        const report = await platformReportService.getFullReport();

        return c.json({
            success: true,
            report,
        });
    } catch (error: any) {
        console.error('[Platform Report Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

// ─────────────────────────────────────────────
//  GET /api/platform/report/ontology
//  Ontology-specific revenue breakdown
// ─────────────────────────────────────────────
platformRouter.get('/report/ontology', async (c) => {
    const authError = await requireAdmin(c);
    if (authError) return authError;

    try {
        const ontology = await platformReportService.getOntologyMetrics();

        return c.json({
            success: true,
            ontology,
        });
    } catch (error: any) {
        console.error('[Platform Ontology Report Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

// ─────────────────────────────────────────────
//  GET /api/platform/report/revenue
//  Revenue-only breakdown
// ─────────────────────────────────────────────
platformRouter.get('/report/revenue', async (c) => {
    const authError = await requireAdmin(c);
    if (authError) return authError;

    try {
        const revenue = await platformReportService.getRevenueMetrics();

        return c.json({
            success: true,
            revenue,
        });
    } catch (error: any) {
        console.error('[Platform Revenue Report Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

export default platformRouter;
