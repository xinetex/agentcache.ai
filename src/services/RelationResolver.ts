/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { RelationStrategy, RelationResult } from './relation/RelationStrategy.js';
import { CoOccurrenceStrategy } from './relation/CoOccurrenceStrategy.js';
import { TemplatePatternStrategy } from './relation/TemplatePatternStrategy.js';
import { OntologyConstraints } from '../ontology/OntologyConstraints.js';

/**
 * RelationResolver: Pluggable Orchestrator for Semantic Relations.
 * 
 * Axis 3: Pluggable Relation Scoring (Multiple strategies).
 * Axis 2: Ontology Constraints (Post-filtering).
 */
export class RelationResolver {
    private strategies: RelationStrategy[] = [];

    constructor() {
        // Register default strategies
        this.strategies.push(new CoOccurrenceStrategy());
        this.strategies.push(new TemplatePatternStrategy());
    }

    /**
     * Resolves potential relationships between a set of extracted entities.
     */
    async resolve(text: string, entities: string[]): Promise<RelationResult[]> {
        if (entities.length < 2) return [];

        // 1. Execute all strategies (Axis 3)
        const rawResults = await Promise.all(
            this.strategies.map(s => s.extract(text, entities))
        );

        // 2. Aggregate and De-duplicate
        const flatResults = rawResults.flat();
        const bestHits: Map<string, RelationResult> = new Map();

        for (const hit of flatResults) {
            const key = `${hit.subject}-${hit.predicate}-${hit.object}`;
            const existing = bestHits.get(key);
            
            if (!existing || hit.confidence > existing.confidence) {
                bestHits.set(key, hit);
            }
        }

        // 3. Post-Filter: Ontology Constraints (Axis 2)
        const validatedHits: RelationResult[] = [];
        for (const hit of bestHits.values()) {
            if (OntologyConstraints.isValid(hit.subject, hit.predicate, hit.object)) {
                validatedHits.push(hit);
            } else {
                console.warn(`[RelationResolver] 🚫 Rejecting invalid triple: (${hit.subject} : ${hit.predicate} : ${hit.object})`);
                
                // AXIS 2: Attempt Correction/Downgrade if it's just a predicate mismatch
                const subType = OntologyConstraints.getType(hit.subject);
                const objType = OntologyConstraints.getType(hit.object);
                const allowed = OntologyConstraints.getAllowedPredicates(subType, objType);
                
                if (allowed.length > 0 && hit.source === 'co-occurrence') {
                    // Downgrade to an allowed predicate for co-occurrence matches
                    hit.predicate = allowed[0];
                    validatedHits.push(hit);
                }
            }
        }

        return validatedHits;
    }

    /**
     * Allow adding custom strategies (e.g. LLM-based) at runtime.
     */
    addStrategy(strategy: RelationStrategy) {
        this.strategies.push(strategy);
    }
}

export const relationResolver = new RelationResolver();
