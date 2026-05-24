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
 * OntologyConstraints: The Rulebook for Semantic Relations.
 * 
 * Defines allowed triples (SubjectType, Predicate, ObjectType) and 
 * maps vocabulary terms to their semantic types.
 */
export class OntologyConstraints {
    
    // Mapping of term -> Semantic Type
    private static typeMap: Record<string, string> = {
        // Metrics
        'risk': 'Metric', 'return': 'Metric', 'exposure': 'Metric',
        'volatility': 'Metric', 'liquidity': 'Metric', 'alpha': 'Metric',
        'beta': 'Metric', 'sharpe': 'Metric', 'drawdown': 'Metric',
        'var': 'Metric', 'yield': 'Metric', 'efficacy': 'Metric',
        'toxicity': 'Metric', 'potency': 'Metric', 'biomarker': 'Metric',
        'capacity_factor': 'Metric', 'frequency': 'Metric',
        // Processes
        'settlement': 'Process', 'clearing': 'Process', 'treatment': 'Process',
        'trial': 'Process', 'navigation': 'Process', 'dispatch': 'Process',
        'execution': 'Process', 'arbitration': 'Process', 'procedure': 'Process',
        // Governance
        'compliance': 'Governance', 'audit': 'Governance', 'consent': 'Governance',
        'hipaa': 'Governance', 'certification': 'Governance', 'regulatory': 'Governance',
        'jurisdiction': 'Governance', 'ferc': 'Governance',
        // Entities
        'asset': 'Entity', 'instrument': 'Entity', 'position': 'Entity',
        'patient': 'Entity', 'practitioner': 'Entity', 'counterparty': 'Entity',
        'party': 'Entity', 'utility': 'Entity', 'compound': 'Entity',
        'facility': 'Entity', 'platform': 'Entity',
        // Clinical Data
        'diagnosis': 'ClinicalData', 'observation': 'ClinicalData',
        'lab_result': 'ClinicalData', 'vital_sign': 'ClinicalData',
        'adverse_event': 'ClinicalData', 'clinical_data': 'ClinicalData',
        // Infrastructure
        'agent': 'AI', 'circle': 'Infrastructure',
        'sensor': 'Infrastructure', 'grid': 'Infrastructure',
        'ehr': 'Infrastructure', 'substation': 'Infrastructure',
    };

    // Allowed Triples: (SubjectType, Predicate, ObjectType)
    private static allowedTriples: Set<string> = new Set([
        'Entity:HAS_EXPOSURE:Metric',
        'Entity:PERFORMS:Process',
        'Entity:OWNERS:Entity',
        'Process:REDUCES:Metric',
        'Process:GOVERNED_BY:Governance',
        'Entity:TREATED_BY:Process',
        'Entity:MONITORS:Metric',
        'AI:MANAGES:Infrastructure',
        'AI:CAUSES:Metric'
    ]);

    /**
     * Get the semantic type of a term. 
     * Defaults to 'GenericEntity' if unknown.
     */
    static getType(term: string): string {
        return this.typeMap[term.toLowerCase()] || 'GenericEntity';
    }

    /**
     * Validate if a triple is semantically valid according to the ontology.
     */
    static isValid(subjectTerm: string, predicate: string, objectTerm: string): boolean {
        const subType = this.getType(subjectTerm);
        const objType = this.getType(objectTerm);
        const tripleKey = `${subType}:${predicate}:${objType}`;
        
        return this.allowedTriples.has(tripleKey);
    }

    /**
     * List all allowed predicates for a given subject/object type pair.
     */
    static getAllowedPredicates(subType: string, objType: string): string[] {
        const results: string[] = [];
        const prefix = `${subType}:`;
        const suffix = `:${objType}`;
        
        for (const triple of this.allowedTriples) {
            if (triple.startsWith(prefix) && triple.endsWith(suffix)) {
                results.push(triple.split(':')[1]);
            }
        }
        return results;
    }
}
