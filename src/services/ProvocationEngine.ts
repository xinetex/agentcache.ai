/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { observabilityService } from './ObservabilityService.js';

export type ProvocationType = 'INPUT' | 'INFRASTRUCTURE' | 'COGNITIVE';

export interface ProvocationConfig {
    type: ProvocationType;
    severity: number; // 0.0 to 1.0
    target?: string; // e.g., 'FINANCE', 'CognitiveEngine'
    durationMs?: number;
}

/**
 * ProvocationEngine
 * 
 * The system's "Chaos Monkey" for Phase 13.
 * It injects intentional stressors into the cognitive substrate to verify 
 * self-correction and feedback loops via telemetry.
 */
export class ProvocationEngine {
    private activeProvocations: Map<string, ProvocationConfig> = new Map();

    /**
     * Inject a new provocation into the system.
     */
    async inject(id: string, config: ProvocationConfig): Promise<void> {
        console.log(`[ProvocationEngine] 🔥 Injecting ${config.type} chaos: ${id} (Severity: ${config.severity})`);
        this.activeProvocations.set(id, config);

        await observabilityService.track({
            type: 'PROVOCATION' as any,
            description: `Chaos Injected: ${config.type} (${id})`,
            metadata: {
                provocationId: id,
                config
            }
        });

        if (config.durationMs) {
            setTimeout(() => this.withdraw(id), config.durationMs);
        }
    }

    /**
     * Withdraw an active provocation.
     */
    async withdraw(id: string): Promise<void> {
        const config = this.activeProvocations.get(id);
        if (config) {
            console.log(`[ProvocationEngine] ❄️ Withdrawing provocation: ${id}`);
            this.activeProvocations.delete(id);

            await observabilityService.track({
                type: 'PROVOCATION_WITHDRAWN' as any,
                description: `Chaos Withdrawn: ${config.type} (${id})`,
                metadata: {
                    provocationId: id,
                    type: config.type
                }
            });
        }
    }

    /**
     * Check if a specific type of chaos is active for a target.
     */
    isActive(type: ProvocationType, target?: string): boolean {
        for (const config of this.activeProvocations.values()) {
            if (config.type === type) {
                if (!target || !config.target || config.target === target) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Get the highest severity for a specific provocation type.
     */
    getSeverity(type: ProvocationType, target?: string): number {
        let maxSeverity = 0;
        for (const config of this.activeProvocations.values()) {
            if (config.type === type) {
                if (!target || !config.target || config.target === target) {
                    maxSeverity = Math.max(maxSeverity, config.severity);
                }
            }
        }
        return maxSeverity;
    }

    /**
     * class-specific stressors
     */

    // Infrastructure: Simulate Latency
    async applyLatency(ms: number): Promise<void> {
        if (this.isActive('INFRASTRUCTURE')) {
            const severity = this.getSeverity('INFRASTRUCTURE');
            const actualDelay = ms * severity;
            if (actualDelay > 0) {
                await new Promise(r => setTimeout(r, actualDelay));
                await observabilityService.track({
                    type: 'PROVOCATION_EFFECT' as any,
                    description: `ProvocationEngine: Latency applied: ${actualDelay}ms`,
                    metadata: { type: 'INFRASTRUCTURE', effect: 'latency', duration: actualDelay }
                });
            }
        }
    }

    // Input: Mutate Content (Simulate corrupted signals)
    mutateContent(content: string): string {
        if (this.isActive('INPUT')) {
            const severity = this.getSeverity('INPUT');
            if (Math.random() < severity) {
                console.log(`[ProvocationEngine] 🧬 Corrupting input signal...`);
                return content.split('').reverse().join(''); // Simple destructive mutation
            }
        }
        return content;
    }

    // Cognitive: Injected Uncertainty
    shouldInhibitResonance(): boolean {
        if (this.isActive('COGNITIVE')) {
            const severity = this.getSeverity('COGNITIVE');
            return Math.random() < severity;
        }
        return false;
    }
}

export const provocationEngine = new ProvocationEngine();
