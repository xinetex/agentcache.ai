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
