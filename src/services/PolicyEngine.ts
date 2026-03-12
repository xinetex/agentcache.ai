/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { BusMessage } from './SemanticBusService.js';
import { ontologyRegistry } from '../ontology/OntologyRegistry.js';
import { observabilityService } from './ObservabilityService.js';
import { sloMonitor } from './SLOMonitor.js';
import { chaosRecoveryEngine, Sector } from './ChaosRecoveryEngine.js';
import { reputationService } from './ReputationService.js';

export interface PolicyResult {
    allowed: boolean;
    reason?: string;
    score: number; // 0.0 to 1.0 confidence
}

export interface Policy {
    id: string;
    description: string;
    evaluate(message: BusMessage): Promise<PolicyResult>;
}

/**
 * PolicyEngine: The "Governor" of the AgentCache Swarm.
 * 
 * It ensures that all signals on the Semantic Bus adhere to
 * ontological constraints, security policies, and domain-specific rules.
 */
export class PolicyEngine {
    private policies: Policy[] = [];

    constructor() {
        this.initializeDefaultPolicies();
    }

    private initializeDefaultPolicies() {
        // 1. Ontological Purity Policy
        this.policies.push({
            id: 'ontological-purity',
            description: 'Ensures messages match the target sector schema.',
            evaluate: async (msg) => {
                const ontology = ontologyRegistry.resolve(msg.sector.toLowerCase());
                if (!ontology) return { allowed: true, score: 1.0 }; // Unknown sector, pass through

                const schema = ontology.schema;
                try {
                    const validation = schema.safeParse(msg.payload);
                    if (!validation.success) {
                        console.log(`[PolicyEngine] Ontological validation failed for ${msg.sector}. Payload:`, JSON.stringify(msg.payload, null, 2));

                        // Signal SLO Monitor that a correction loop has started for this agent
                        if (msg.originAgent) {
                            sloMonitor.trackCorrectionStart(msg.originAgent);

                            // Compute and track a recovery plan (Phase 13 Expansion)
                            const recoveryPlan = chaosRecoveryEngine.computePlan({
                                sector: msg.sector.toLowerCase() as Sector,
                                ttlMs: ontology.cacheTtlSeconds * 1000,
                                eventAgeMs: 0, // Fresh rejection
                                errorKind: 'schema_violation',
                                previousAttempts: 0,
                                maxAllowedAttempts: 3,
                                severity: 'medium'
                            });
                            // Fire and forget tracking to avoid blocking the bus
                            sloMonitor.trackRecoveryPlan(recoveryPlan).catch(e => console.error('Recovery tracking failed', e));
                        }

                        return {
                            allowed: false,
                            score: 0.0,
                            reason: `Ontology Violation: ${JSON.stringify(validation.error.issues, null, 2)}`
                        };
                    }
                    return { allowed: true, score: 1.0 };
                } catch (e: any) {
                    console.log(`[PolicyEngine] Critical Error during validation:`, e.message);
                    return { allowed: false, score: 0.0, reason: `Policy System Error: ${e.message}` };
                }
            }
        });

        // 2. Security: Anti-Injection Policy (Cross-Agent)
        this.policies.push({
            id: 'signal-integrity',
            description: 'Redacts adversarial payloads on the bus.',
            evaluate: async (msg) => {
                const payloadStr = JSON.stringify(msg.payload || msg.content).toLowerCase();
                const forbidden = ['system:', 'override:', 'grant access', 'drop table'];
                
                if (forbidden.some(p => payloadStr.includes(p))) {
                    if (msg.originAgent) {
                        reputationService.trackStat(msg.originAgent, 'totalTasks');
                        reputationService.trackStat(msg.originAgent, 'cognitiveErrors');
                    }
                    return { allowed: false, score: 0.0, reason: 'Security Violation: Adversarial Signal Pattern' };
                }
                return { allowed: true, score: 1.0 };
            }
        });
    }

    /**
     * Evaluate a message against all registered policies.
     */
    async evaluate(message: BusMessage): Promise<PolicyResult> {
        for (const policy of this.policies) {
            const result = await policy.evaluate(message);
            if (!result.allowed) {
                console.warn(`[PolicyEngine] Message REJECTED by policy "${policy.id}": ${result.reason}`);
                
                // Phase 12 Telemetry
                observabilityService.track({
                    type: 'POLICY',
                    description: `Message rejected by policy: ${policy.id}`,
                    metadata: {
                        policyId: policy.id,
                        reason: result.reason,
                        score: result.score,
                        sector: message.sector
                    }
                }).catch(e => console.error('Observability track failed', e));

                return result;
            }
        }

        return { allowed: true, score: 1.0 };
    }

    /**
     * Determine if a message is a candidate for Optimistic Governance (Asynchronous Check).
     * High-stakes or high-value signals must always be synchronous.
     */
    isOptimisticCandidate(msg: BusMessage): boolean {
        const sector = msg.sector.toLowerCase();
        
        // 1. Sector-based hard blocks: Healthcare is NEVER optimistic (High Stakes)
        if (sector === 'healthcare') return false;

        // 2. Value-based thresholds (Example: Finance trades > $1000 are sync)
        if (sector === 'finance' && msg.payload?.quantity && msg.payload?.price) {
            const totalValue = msg.payload.quantity * msg.payload.price;
            if (totalValue > 1000) return false;
        }

        // 3. Security check: messages with sensitive keywords are NEVER optimistic
        const payloadStr = JSON.stringify(msg.payload || msg.content).toLowerCase();
        const sensitive = ['admin', 'root', 'security', 'auth'];
        if (sensitive.some(s => payloadStr.includes(s))) return false;

        return true;
    }

    /**
     * Register a new custom policy (e.g., Tenant-Specific)
     */
    registerPolicy(policy: Policy) {
        this.policies.push(policy);
    }
}

export const policyEngine = new PolicyEngine();
