/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * Economy API: Provides real-time financial telemetry for the substrate.
 * Phase 6: Substrate Revenue Monitoring.
 */

import { Hono } from 'hono';
import { solanaEconomyService } from '../services/SolanaEconomyService.js';
import { economicAuditService } from '../services/EconomicAuditService.js';
import { complianceSwarmOrchestrator } from '../services/ComplianceSwarmOrchestrator.js';
import { sectorSolutionOrchestrator } from '../services/SectorSolutionOrchestrator.js';

const economyRouter = new Hono();

/**
 * GET /api/economy/stats
 * Aggregates volume, revenue, and audit status.
 */
economyRouter.get('/stats', async (c) => {
    try {
        const audit = await economicAuditService.performAudit();
        const balanceLedger = await solanaEconomyService.getRecentTransactions();
        
        // Calculate velocity (transactions per hour - simulated for now)
        const recentTxs = balanceLedger.filter(tx => 
            new Date(tx.timestamp).getTime() > Date.now() - 3600000
        );

        const complianceStats = await complianceSwarmOrchestrator.getSwarmStats();
        const sectorSolutions = await sectorSolutionOrchestrator.getActiveSolutions();

        return c.json({
            ...audit,
            recentTransactionCount: recentTxs.length,
            velocity: (recentTxs.length / 1).toFixed(2), // Txs/hr
            totalTransactions: balanceLedger.length,
            compliance: complianceStats,
            activeSectors: sectorSolutions.length
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * GET /api/economy/ledger
 * Returns the raw transaction history.
 */
economyRouter.get('/ledger', async (c) => {
    try {
        const ledger = await solanaEconomyService.getRecentTransactions();
        return c.json(ledger);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { economyRouter };
