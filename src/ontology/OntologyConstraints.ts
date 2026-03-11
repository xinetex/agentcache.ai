
/**
 * OntologyConstraints: The Rulebook for Semantic Relations.
 * 
 * Defines allowed triples (SubjectType, Predicate, ObjectType) and 
 * maps vocabulary terms to their semantic types.
 */
export class OntologyConstraints {
    
    // Mapping of term -> Semantic Type
    private static typeMap: Record<string, string> = {
        'risk': 'Metric',
        'return': 'Metric',
        'exposure': 'Metric',
        'volatility': 'Metric',
        'liquidity': 'Metric',
        'settlement': 'Process',
        'compliance': 'Governance',
        'asset': 'Entity',
        'instrument': 'Entity',
        'position': 'Entity',
        'patient': 'Entity',
        'doctor': 'Entity',
        'diagnosis': 'ClinicalData',
        'treatment': 'Process',
        'agent': 'AI',
        'circle': 'Infrastructure'
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
