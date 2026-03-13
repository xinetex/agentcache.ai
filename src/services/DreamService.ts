/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * DreamService: The "Functorial Dream Orchestrator."
 * Synthesizes actionable wisdom from raw experience traces using 
 * DeepSeek R1 reasoning and Latent Manipulator logic.
 */

import { db } from '../db/client.js';
import { 
    periscopeRuns, 
    periscopeSteps, 
    periscopeActions, 
    patterns, 
    agentAlerts 
} from '../db/schema.js';
import { eq, sql, desc, and, ne } from 'drizzle-orm';
import { cognitiveEngine } from '../infrastructure/CognitiveEngine.js';

export interface Morphism {
    intent: string;
    actionSequence: any[];
    latentDelta?: number[];
    reasoning: string;
}

export class DreamService {
    /**
     * Primary entry point for the dreaming process.
     * Extracts morphisms from failed traces and manifests them as patterns.
     */
    async dream(limit: number = 20): Promise<{ patternsCreated: number; insights: string[] }> {
        console.log("[DreamService] 💤 Entering Delta-Sleep. Processing experience clusters...");
        
        const insights: string[] = [];
        let patternsCreated = 0;

        // 1. Extraction: Identify failure clusters
        // Find failed actions first, then get their runs
        const failedActions = await db.select({
            stepId: periscopeActions.stepId
        })
        .from(periscopeActions)
        .where(eq(periscopeActions.success, false))
        .limit(limit);

        if (failedActions.length === 0) {
            console.log("[DreamService] ☀️ No nightmares detected. Dreaming complete.");
            return { patternsCreated: 0, insights: ["No failures found to optimize."] };
        }

        const stepIds = failedActions.map(a => a.stepId).filter(id => !!id) as string[];
        
        // Get the runs for these steps
        const failedSteps = await db.select({
            runId: periscopeSteps.runId
        })
        .from(periscopeSteps)
        .where(sql`${periscopeSteps.id} IN ${stepIds}`);

        const runIds = failedSteps.map(s => s.runId).filter(id => !!id) as string[];

        const failedRuns = await db.select({
            id: periscopeRuns.id,
            agentId: periscopeRuns.agentId,
            sessionId: periscopeRuns.sessionId
        })
        .from(periscopeRuns)
        .where(sql`${periscopeRuns.id} IN ${runIds}`);

        if (failedRuns.length === 0) {
            console.log("[DreamService] ☀️ No nightmares detected. Dreaming complete.");
            return { patternsCreated: 0, insights: ["No failures found to optimize."] };
        }

        console.log(`[DreamService] 🧠 Found ${failedRuns.length} failure clusters. Synthesizing morphisms...`);

        // 2. Synthesis: Process clusters into morphisms
        for (const run of failedRuns) {
            const morphism = await this.synthesizeMorphism(run.id);
            if (morphism) {
                // Security Check: Intent Drift (Phase 35)
                if (morphism.latentDelta) {
                    const { drifted } = await cognitiveEngine.detectIntentDrift(morphism.latentDelta);
                    if (drifted) {
                        console.warn(`[DreamService] 🚫 Morphism for run ${run.id} rejected due to extreme Intent Drift.`);
                        insights.push(`Rejected drifted morphism for run: ${run.id}`);
                        continue;
                    }
                }

                // 3. Manifestation: Persist synthesized wisdom
                const patternId = await this.manifestPattern(morphism);
                if (patternId) {
                    patternsCreated++;
                    insights.push(`Synthesized pattern: ${morphism.intent}`);
                }
            }
        }

        console.log(`[DreamService] ✅ Awakening. Created ${patternsCreated} new patterns.`);
        return { patternsCreated, insights };
    }

    /**
     * Reasoning: Use System 2 logic to transform a failed trace into a success strategy.
     */
    private async synthesizeMorphism(runId: string): Promise<Morphism | null> {
        // Fetch full trace details
        // Split join for mock compatibility
        const steps = await db.select()
            .from(periscopeSteps)
            .where(eq(periscopeSteps.runId, runId))
            .orderBy(periscopeSteps.index);

        if (steps.length === 0) return null;

        const stepIds = steps.map(s => s.id);
        const actionsRaw = await db.select()
            .from(periscopeActions)
            .where(sql`${periscopeActions.stepId} IN ${stepIds}`);

        // Merge actions with their steps for the summary
        const traceSummary = steps.map(s => {
            const stepActions = actionsRaw.filter(a => a.stepId === s.id);
            return stepActions.map(a => ({
                step: s.index,
                tool: a.toolName,
                success: a.success,
                error: a.errorCode,
                latency: a.latencyMs
            }));
        }).flat();

        if (traceSummary.length === 0) return null;

        // System 2 Reasoning via Cognitive Engine (DeepSeek R1 simulation)
        // We prompt the engine to find the "Functorial Mapping" from failure to success.
        const reasoningPrompt = `
Analyze this failed agent trace and synthesize an optimized "Action Ritual" (Pattern).
Trace: ${JSON.stringify(traceSummary)}

Goal: Provide a more robust action sequence that avoids these pitfalls.
Return JSON only: {
  "intent": "Short descriptive name for the optimization",
  "actionSequence": [ { "tool": "name", "params": {} } ],
  "reasoning": "Why this change fixes the issue"
}`;

        // Using validateMemory as a generic LLM proxy for prototype, 
        // in prod this would be a specialized 'reason' call.
        const result = await cognitiveEngine.validateMemory(reasoningPrompt);
        
        try {
            const morphismData = JSON.parse(result.reason || '{}');
            if (morphismData.intent && morphismData.actionSequence) {
                // Integrate Latent Manipulator Formula
                const latentDelta = this.synthesizeLatentDelta(traceSummary);
                
                return {
                    ...morphismData,
                    latentDelta
                };
            }
        } catch (e) {
            console.error("[DreamService] Failed to parse synthesized morphism:", e);
        }

        return null;
    }

    /**
     * The Formula: Residually-Concatenated Latent Synthesis
     * This mimics the MLP structure from the Latent Manipulator Cookbook.
     */
    private synthesizeLatentDelta(trace: any[]): number[] {
        // Simplified implementation of concat([x, c1...c7])
        // x = base failure vector (simulated)
        // cN = "choke" representations of individual step failures.
        const delta = new Array(1024).fill(0);
        
        // Fill based on step outcomes (Functorial "Nudge")
        trace.forEach((step, i) => {
            if (!step.success) {
                const weight = 0.1 / (i + 1);
                // "Choke" influence: early failures are more critical
                for (let j = 0; j < 100; j++) {
                    delta[j + (i % 10) * 100] += weight;
                }
            }
        });

        return delta;
    }

    /**
     * Manifestation: Write the morphism to the global Pattern store.
     */
    private async manifestPattern(morphism: Morphism): Promise<string | null> {
        try {
            const [newPattern] = await db.insert(patterns).values({
                name: `Dream: ${morphism.intent}`,
                intent: morphism.intent,
                triggerCondition: { type: 'event', value: 'failure_detected' },
                actionSequence: morphism.actionSequence,
                energyLevel: 10, // Initial energy for dream patterns
                status: 'active'
            }).returning({ id: patterns.id });

            // Log to alerts for visibility
            await db.insert(agentAlerts).values({
                agentName: 'DreamOrchestrator',
                severity: 'low',
                message: `Manifested new pattern from dream: ${morphism.intent}`,
                context: { reasoning: morphism.reasoning, latentDelta: morphism.latentDelta ? 'computed' : 'none' }
            });

            return newPattern.id;
        } catch (e) {
            console.error("[DreamService] Failed to manifest pattern:", e);
            return null;
        }
    }
}

export const dreamService = new DreamService();
