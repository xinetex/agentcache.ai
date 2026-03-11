/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

/**
 * TriageLogic
 * 
 * The "medical" logic for the Inquiry Triage agent.
 * Analyzes alerts and provides remediation plans.
 */
export class TriageLogic {

    /**
     * Analyze an alert and determine the root cause and recommended fix.
     */
    static analyzeAlert(alert: any): { diagnosis: string; recommendedAction: any } {
        const msg = alert.message.toLowerCase();
        const severity = alert.severity;

        // Heuristics
        if (msg.includes('loop') || msg.includes('stuck')) {
            return {
                diagnosis: 'Cognitive Loop Detected',
                recommendedAction: {
                    type: 'apply_fix',
                    targetId: alert.context?.patternId,
                    fixType: 'restart',
                    reason: 'Breaking infinite loop'
                }
            };
        }

        if (msg.includes('energy') || msg.includes('drained')) {
            return {
                diagnosis: 'Metabolic Exhaustion',
                recommendedAction: {
                    type: 'apply_fix',
                    targetId: alert.patternId || alert.context?.patternId,
                    fixType: 'boost_energy',
                    amount: 50,
                    reason: 'Emergency resuscitation'
                }
            };
        }

        if (severity === 'critical') {
            return {
                diagnosis: 'Critical Unknown Failure',
                recommendedAction: {
                    type: 'apply_fix',
                    targetId: alert.context?.patternId,
                    fixType: 'quarantine',
                    reason: 'Containment of unknown critical error'
                }
            };
        }

        return {
            diagnosis: 'Minor Irregularity',
            recommendedAction: {
                type: 'log',
                message: `Acknowledged alert from ${alert.agentName}. Monitoring.`
            }
        };
    }
}
