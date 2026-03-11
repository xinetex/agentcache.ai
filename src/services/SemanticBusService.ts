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

export interface BusMessage {
    content: string;
    sector: string;
    payload?: any;
    origin?: string;
    ontologyRef?: string;
}

import { policyEngine } from './PolicyEngine.js';

/**
 * SemanticBusService
 * 
 * The backbone for Phase 6. It intercepts messages and automatically:
 * 1. Extracts entities based on sector vocabulary.
 * 2. Resolves cross-sector synonyms (Semantic Resonance).
 * 3. Dispatches ontology-aware synapses to the Cortex Bridge.
 */
export class SemanticBusService {

    /**
     * Publish a message to the semantic bus.
     */
    async publish(msg: BusMessage): Promise<void> {
        // 0. Policy Enforcement (Governance Tier)
        const policyResult = await policyEngine.evaluate(msg);
        if (!policyResult.allowed) {
            console.warn(`[SemanticBus] 🛑 Message blocked by policy: ${policyResult.reason}`);
            return;
        }

        const { sector, content, ontologyRef } = msg;

        // 1. Resolve Sector Ontology
        // If ontologyRef is provided like "finance@1.0.0", use it. Otherwise use latest.
        const [sectorId, version] = ontologyRef?.split('@') || [sector.toLowerCase()];
        const ontology = ontologyRegistry.resolve(sectorId, version);

        if (!ontology) {
            console.warn(`[SemanticBus] No ontology found for sector: ${sectorId}`);
            return;
        }

        // 2. Automated Entity Extraction (Robust via Word Boundaries)
        const { EntityMatcher } = await import('./EntityMatcher.js');
        const extractedEntities = EntityMatcher.findMatches(content, ontology.vocabulary);

        // 3. Automated Relation Mapping (Dynamic via pluggable RelationResolver)
        const { relationResolver } = await import('./RelationResolver.js');
        const relations = await relationResolver.resolve(content, extractedEntities);

        // 4. Cross-Sector Resonance (Ontology Bridge)
        const resonances = ontologyBridge.federatedQuery(extractedEntities[0] || content);

        // 5. Dispatch to Cortex Bridge
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

        console.log(`[SemanticBus] 📡 Published message from ${sectorId}. Entities found: ${extractedEntities.join(', ')}`);
    }
}

export const semanticBusService = new SemanticBusService();
