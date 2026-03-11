
export interface RelationResult {
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
    source: string; // The strategy name
}

/**
 * RelationStrategy: Common interface for all relation extraction methods.
 * 
 * This allows the RelationResolver to orchestrate multiple approaches 
 * (heuristics, patterns, LLMs) behind a unified interface.
 */
export interface RelationStrategy {
    name: string;
    extract(text: string, entities: string[]): Promise<RelationResult[]>;
}
