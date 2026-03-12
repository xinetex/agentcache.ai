/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { cortexBridge } from './CortexBridge.js';
import { ontologyRegistry } from '../ontology/OntologyRegistry.js';
import { ontologyBridge } from '../ontology/OntologyBridge.js';
import { cognitiveEngine } from '../infrastructure/CognitiveEngine.js';
import { provocationEngine } from './ProvocationEngine.js';
import { sloMonitor } from './SLOMonitor.js';
import { reputationService } from './ReputationService.js';
import { driftMonitor } from './DriftMonitor.js';
import { generateEmbedding } from '../lib/llm/embeddings.js';
import { observabilityService } from './ObservabilityService.js';
import { Sector, chaosRecoveryEngine } from './ChaosRecoveryEngine.js';
import { interventionGate } from './InterventionGate.js';
import { policyEngine } from './PolicyEngine.js';

export interface BusMessage {
    content: string;
    sector: string;
    payload?: any;
    origin?: string;
    originAgent?: string;
    circleId?: string;
    ontologyRef?: string;
}

/**
 * SemanticBusService
 * 
 * The backbone for Phase 6. It intercepts messages and automatically:
 * 1. Extracts entities based on sector vocabulary.
 * 2. Resolves cross-sector synonyms (Semantic Resonance).
 * 3. Dispatches ontology-aware synapses to the Cortex Bridge.
 */
export class SemanticBusService {

    private anchorsInitialized = false;

    /**
     * Publish a message to the semantic bus.
     */
    async publish(msg: BusMessage): Promise<void> {
        // 0. Initialize Anchors on first use
        if (!this.anchorsInitialized) {
            await driftMonitor.initializeDefaultAnchors(generateEmbedding);
            this.anchorsInitialized = true;
        }

        const { sector, content, ontologyRef } = msg;
        const msgId = `bus_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        // 1. Generate Embedding and Measure Drift (Needed for Intervention Context)
        const vector = await generateEmbedding(content);
        const drift = await driftMonitor.measureDrift(sector.toLowerCase() as Sector, vector);
        
        // 2. Multi-Signal Governance: Intervention Gate (Phase 15)
        let decisionAction: string = 'allow';
        if (msg.originAgent) {
            const stats = reputationService.getStats(msg.originAgent);
            const rep = reputationService.getReputation(msg.originAgent);
            
            const ctx = {
                agentId: msg.originAgent,
                sector: sector,
                taskType: 'signal_publish',
                riskLevel: (['healthcare', 'energy'].includes(sector.toLowerCase()) ? 'high' : 'medium') as any,
                reputation: rep.reputation,
                cogCost: sloMonitor.getSnapshot().recoveryCostScore,
                driftScore: drift,
                chaosMode: provocationEngine.isActive('COGNITIVE') ? 'provocation' : 'normal',
                recentOverrideRate: stats.totalTasks > 0 ? stats.humanOverrides / stats.totalTasks : 0,
                recentErrorRate: stats.totalTasks > 0 ? stats.cognitiveErrors / stats.totalTasks : 0
            };

            const decision = interventionGate.assess(ctx as any);
            decisionAction = decision.action;

            if (drift > 0) {
                await reputationService.applyDriftDecay(msg.originAgent, drift);
            }

            await observabilityService.track({
                type: 'POLICY',
                description: `Intervention Gate Decision: ${decision.action.toUpperCase()} (Risk: ${decision.riskScore.toFixed(2)})`,
                metadata: { agentId: msg.originAgent, decision }
            });
        }

        // 3. Execution Path Selection (Optimistic vs Stance)
        const isOptimisticCandidate = policyEngine.isOptimisticCandidate(msg);
        // Force synchronous check for 'hard_review'
        const shouldBeOptimistic = isOptimisticCandidate && decisionAction !== 'hard_review';
        
        let policyPromise: Promise<any>;

        if (shouldBeOptimistic) {
            // Hot Path: Publish immediately, evaluate asynchronously
            policyPromise = policyEngine.evaluate(msg).then(async (result) => {
                if (!result.allowed) {
                    // post-facto rejection: Issue CLAWBACK
                    await observabilityService.track({
                        type: 'CLAWBACK',
                        description: `🛑 CLAWBACK: Optimistic message rejected post-facto: ${result.reason}`,
                        metadata: { msgId, originAgent: msg.originAgent, reason: result.reason }
                    });
                    if (msg.originAgent) {
                        reputationService.trackStat(msg.originAgent, 'totalTasks');
                        reputationService.trackStat(msg.originAgent, 'cognitiveErrors');
                    }
                }
            });
            
            if (decisionAction === 'soft_review') {
                console.log(`[SemanticBus] ⚠️ Proceeding with caution (SOFT_REVIEW) for message ${msgId}`);
            }
        } else {
            // Stance Path: Wait for synchronous policy check
            const policyResult = await policyEngine.evaluate(msg);
            if (!policyResult.allowed) {
                console.warn(`[SemanticBus] 🛑 Message blocked by policy: ${policyResult.reason}`);
                return;
            }
        }

        // 3. Resolve Sector Ontology
        // If ontologyRef is provided like "finance@1.0.0", use it. Otherwise use latest.
        const [sectorId, version] = ontologyRef?.split('@') || [sector.toLowerCase()];
        const ontology = ontologyRegistry.resolve(sectorId, version);

        if (!ontology) {
            console.warn(`[SemanticBus] No ontology found for sector: ${sectorId}`);
            return;
        }

        // 4. Automated Entity Extraction (Robust via Word Boundaries)
        const { EntityMatcher } = await import('./EntityMatcher.js');
        const extractedEntities = EntityMatcher.findMatches(content, ontology.vocabulary);

        // 5. Automated Relation Mapping (Dynamic via pluggable RelationResolver)
        const { relationResolver } = await import('./RelationResolver.js');
        const relations = await relationResolver.resolve(content, extractedEntities);

        // 6. Cross-Sector Resonance (Ontology Bridge)
        const resonances = ontologyBridge.federatedQuery(extractedEntities[0] || content);

        // 7. Store in Cognitive Memory (with metadata for Resonance)
        await (cognitiveEngine as any).storeMemoryVector(msgId, content, {
            type: 'bus_signal',
            sector: sectorId,
            originAgent: msg.originAgent,
            circleId: msg.circleId,
            entities: extractedEntities
        });

        // 8. Dispatch to Cortex Bridge
        await cortexBridge.synapse({
            sector: sector as any,
            type: extractedEntities.length > 0 ? 'DISCOVERY' : 'OPTIMIZATION',
            message: `Semantic Bus: ${content.substring(0, 50)}...`,
            entities: extractedEntities,
            relations: relations,
            ontologyRef: `${ontology.sectorId}@${ontology.version}`,
            data: {
                resonances: resonances.map(r => r.sectorId)
            }
        });

        if (msg.originAgent) {
            await sloMonitor.trackCorrectionSuccess(msg.originAgent);
            reputationService.trackStat(msg.originAgent, 'totalTasks');
        }

        await observabilityService.track({
            type: 'BUS_PUBLISH' as any,
            description: `[${sector}] Semantic Bus: ${content.substring(0, 30)}...`,
            metadata: { sector, originAgent: msg.originAgent, circleId: msg.circleId, drift }
        });

        console.log(`[SemanticBus] 📡 Published message from ${sectorId}. Drift: ${drift.toFixed(2)}. Entities found: ${extractedEntities.join(', ')}`);
    }
}

export const semanticBusService = new SemanticBusService();
