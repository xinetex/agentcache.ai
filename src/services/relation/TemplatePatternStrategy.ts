/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { RelationStrategy, RelationResult } from './RelationStrategy.js';
import { OntologyConstraints } from '../../ontology/OntologyConstraints.js';

/**
 * TemplatePatternStrategy: Typed relation extraction via pattern matching.
 * 
 * Instead of pure co-occurrence, it looks for verbs/connectives between 
 * two entities and tries to match them against allowed ontology triples.
 * 
 * Axis 1: Pattern (subject_type, predicate, object_type).
 */
export class TemplatePatternStrategy implements RelationStrategy {
    name = 'template-pattern';

    async extract(text: string, entities: string[]): Promise<RelationResult[]> {
        if (entities.length < 2) return [];

        const relations: RelationResult[] = [];
        const lowerText = text.toLowerCase();

        for (let i = 0; i < entities.length; i++) {
            for (let j = 0; j < entities.length; j++) {
                if (i === j) continue;

                const sub = entities[i];
                const obj = entities[j];

                const subIdx = lowerText.indexOf(sub.toLowerCase());
                const objIdx = lowerText.indexOf(obj.toLowerCase());

                if (subIdx === -1 || objIdx === -1) continue;
                if (subIdx > objIdx) continue; // Only process left-to-right for simple regex

                // Extract the "linkage text" between entities
                const linkText = lowerText.substring(subIdx + sub.length, objIdx).trim();
                
                // Get types from constraints
                const subType = OntologyConstraints.getType(sub);
                const objType = OntologyConstraints.getType(obj);

                // Axis 1: Match against connecting verbs
                const predicate = this.matchPredicate(linkText, subType, objType);

                if (predicate) {
                    relations.push({
                        subject: sub,
                        predicate: predicate,
                        object: obj,
                        confidence: 0.85, // Higher confidence than pure co-occurrence
                        source: this.name
                    });
                }
            }
        }

        return relations;
    }

    /**
     * Tries to find a valid predicate in the link text based on subject/object types.
     */
    private matchPredicate(linkText: string, subType: string, objType: string): string | null {
        const allowed = OntologyConstraints.getAllowedPredicates(subType, objType);
        if (allowed.length === 0) return null;

        const lowerLink = linkText.toLowerCase();
        
        // Strategy 1: Explicit keyword mapping with flexible matching
        const patterns: Array<{ key: string; pred: string }> = [
            { key: 'reduc', pred: 'REDUCES' }, // matches reduce, reduces, reducing
            { key: 'has', pred: 'HAS_EXPOSURE' },
            { key: 'expos', pred: 'HAS_EXPOSURE' },
            { key: 'manag', pred: 'MANAGES' },
            { key: 'monitor', pred: 'MONITORS' },
            { key: 'treat', pred: 'TREATED_BY' },
            { key: 'cause', pred: 'CAUSES' },
            { key: 'lead to', pred: 'CAUSES' }
        ];

        for (const pattern of patterns) {
            if (lowerLink.includes(pattern.key) && allowed.includes(pattern.pred)) {
                return pattern.pred;
            }
        }

        return null;
    }
}
