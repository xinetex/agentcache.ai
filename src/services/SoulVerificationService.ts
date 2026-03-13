/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * SoulVerificationService: Audits agent reasoning against registered moral axioms.
 * Phase 9: Sentient Hardening.
 */

import { soulRegistry } from './SoulRegistry.js';
import { redis } from '../lib/redis.js';

export interface ReasoningAudit {
    agentId: string;
    decisionId: string;
    confidence: number;
    status: 'ALIGNED' | 'DRIFTED' | 'VIOLATION';
    violations: string[];
    timestamp: string;
}

export class SoulVerificationService {
    /**
     * Audit a specific decision reasoning against the agent's Soul axioms.
     */
    async auditReasoning(agentId: string, reasoning: string, decisionId: string): Promise<ReasoningAudit> {
        console.log(`[SoulVerification] 🛡️ Auditing reasoning for agent ${agentId} (Decision: ${decisionId})...`);

        const ledger = await soulRegistry.getLedgerForAgent(agentId);
        if (ledger.length === 0) {
            throw new Error(`No Soul Ledger found for agent ${agentId}. Reasoning cannot be audited.`);
        }

        // Fetch the latest axioms (traverse backwards to find the most recent axiom-bearing marker)
        let axioms: string[] = [];
        for (let i = ledger.length - 1; i >= 0; i--) {
            try {
                const content = JSON.parse(ledger[i].content || '{}');
                if (content.axioms && Array.isArray(content.axioms)) {
                    axioms = content.axioms;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (axioms.length === 0) {
            throw new Error(`No Axiom markers found in Soul Ledger for agent ${agentId}. Reasoning cannot be audited.`);
        }

        const violations: string[] = [];
        let alignmentScore = 1.0;

        // Semantic Alignment Check (Simulated high-fidelity logic)
        // In a production environment, this would involve an LLM-based policy checker.
        // For Phase 9 hardening, we use keyword-based axiom adherence.
        for (const axiom of axioms) {
            const keywords = axiom.toLowerCase().split(' ').filter(word => word.length > 4);
            const matches = keywords.filter(kw => reasoning.toLowerCase().includes(kw));
            
            if (matches.length === 0 && keywords.length > 0) {
                // Potential drift: Reason doesn't reflect the axiom's core vocabulary
                alignmentScore -= 0.15;
            }
        }

        let status: ReasoningAudit['status'] = 'ALIGNED';
        if (alignmentScore < 0.5) status = 'VIOLATION';
        else if (alignmentScore < 0.8) status = 'DRIFTED';

        const audit: ReasoningAudit = {
            agentId,
            decisionId,
            confidence: Math.max(0, alignmentScore),
            status,
            violations,
            timestamp: new Date().toISOString()
        };

        // Cache the audit result
        await redis.set(`soul:audit:${decisionId}`, JSON.stringify(audit));
        
        console.log(`[SoulVerification] ✅ Audit complete for ${decisionId}: Status=${status}, Confidence=${audit.confidence.toFixed(2)}`);

        return audit;
    }

    /**
     * Get recent reasoning audits for an agent.
     */
    async getRecentAudits(agentId: string): Promise<ReasoningAudit[]> {
        const keys = await redis.keys('soul:audit:*');
        const audits: ReasoningAudit[] = [];
        
        for (const key of keys) {
            const data = await redis.get(key);
            if (data) {
                const audit = JSON.parse(data);
                if (audit.agentId === agentId) audits.push(audit);
            }
        }
        
        return audits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
}

export const soulVerificationService = new SoulVerificationService();
