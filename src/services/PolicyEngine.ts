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
                    schema.parse(msg.payload);
                    return { allowed: true, score: 1.0 };
                } catch (e: any) {
                    return { 
                        allowed: false, 
                        score: 0.0, 
                        reason: `Ontology Violation: ${e.message}` 
                    };
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
                return result;
            }
        }

        return { allowed: true, score: 1.0 };
    }

    /**
     * Register a new custom policy (e.g., Tenant-Specific)
     */
    registerPolicy(policy: Policy) {
        this.policies.push(policy);
    }
}

export const policyEngine = new PolicyEngine();
