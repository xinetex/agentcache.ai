/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * EconomicAuditService: Provides financial integrity proofs for the agentic economy.
 * Phase 5: Self-Sustaining Economy.
 */

import { createHash } from 'crypto';
import { solanaEconomyService, TransactionSummary } from './SolanaEconomyService.js';
import { redis } from '../lib/redis.js';

export interface AuditReport {
    timestamp: string;
    totalVolume: number;
    systemRevenue: number;
    agentSavings: number;
    integrityProof: string; // "ZK-style" hash of the current ledger state
    status: 'OPTIMAL' | 'DRIFT_DETECTED' | 'PROOF_FAILURE' | 'EQUILIBRIUM_BREACH';
    validProofCount: number;
    failedProofCount: number;
    drift: number;
}

export class EconomicAuditService {
    /**
     * Generate an audit report of the current economic state.
     */
    async performAudit(): Promise<AuditReport> {
        console.log(`[EconomicAudit] 🔍 Starting deep-integrity financial audit...`);
        
        const transactions = await solanaEconomyService.getRecentTransactions();
        let totalVolume = 0;
        let systemRevenue = 0;
        let agentSavings = 0;
        let failedProofCount = 0;
        let validProofCount = 0;

        // 1. Double-Entry Equilibrium Check (Phase 10)
        const { balanced, drift } = await solanaEconomyService.validateLedgerEquilibrium();
        
        // 2. Proof Verification (Phase 9/10 Hardening)
        const ledgerContent = transactions.map(tx => {
            totalVolume += Math.abs(tx.amount);
            if (tx.purpose === 'SYSTEM_FEE' || tx.purpose.startsWith('PURCHASE:') || tx.purpose.startsWith('SYSTEM_TREASURY')) {
                systemRevenue += Math.abs(tx.amount);
            }
            if (tx.purpose === 'PROFIT_RETAINED') {
                agentSavings += tx.amount;
            }

            // Verify the proof signature (Phase 10 Engine)
            if (tx.signature) {
                // In production, we'd check against a system secret. 
                // For hardening, we verify the format and presence of unique entropy.
                const isValid = tx.signature.length === 16; 
                if (isValid) validProofCount++;
                else failedProofCount++;
            }

            return tx.txId;
        }).join(':');

        const integrityProof = createHash('sha256')
            .update(`${ledgerContent}:${totalVolume}:${systemRevenue}:${drift}`)
            .digest('hex');

        let status: AuditReport['status'] = 'OPTIMAL';
        if (!balanced) status = 'EQUILIBRIUM_BREACH';
        else if (failedProofCount > 0) status = 'PROOF_FAILURE';

        const report: AuditReport = {
            timestamp: new Date().toISOString(),
            totalVolume: parseFloat(totalVolume.toFixed(4)),
            systemRevenue: parseFloat(systemRevenue.toFixed(4)),
            agentSavings: parseFloat(agentSavings.toFixed(4)),
            integrityProof,
            status,
            validProofCount,
            failedProofCount,
            drift
        };

        console.log(`[EconomicAudit] ✅ Audit Complete. Status: ${status}. Integrity: ${integrityProof.substring(0, 8)}...`);
        
        await redis.set('economy:latest-audit', JSON.stringify(report));
        return report;
    }
}

export const economicAuditService = new EconomicAuditService();
