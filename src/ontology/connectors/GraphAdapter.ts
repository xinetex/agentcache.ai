
/**
 * GraphAdapter: Base interface for Knowledge Graph integrations.
 * 
 * Allows AgentCache to "mount" existing semantic layers (Neo4j, AWS Neptune, etc.)
 * so their entities and relations become addressable on the semantic bus.
 */
export abstract class GraphAdapter {
    abstract readonly adapterType: string;
    
    /**
     * Resolve a node by its ID or canonical name.
     */
    abstract resolveNode(id: string): Promise<any>;

    /**
     * Query for nodes based on semantic properties.
     */
    abstract queryNodes(criteria: Record<string, any>): Promise<any[]>;

    /**
     * Resolve edges (relations) for a given node.
     */
    abstract resolveRelations(nodeId: string, depth?: number): Promise<any[]>;
}
