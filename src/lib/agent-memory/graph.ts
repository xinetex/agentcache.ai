/**
 * Knowledge Graph - In-memory graph for agent relationships and memory links
 * 
 * Provides: relationship tracking, traversal, knowledge discovery
 * For production: Could be backed by Neo4j, DGraph, or PostgreSQL with recursive CTEs
 */

interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  tags: string[];
  createdAt: Date;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  properties: Record<string, any>;
  createdAt: Date;
}

interface TraversalNode {
  id: string;
  depth: number;
  path: string[];
  relation?: string;
}

interface IndexOptions {
  type: string;
  tags: string[];
  relations: Array<{ target: string; type: string }>;
}

export class KnowledgeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];
  private outEdges = new Map<string, GraphEdge[]>(); // source -> edges
  private inEdges = new Map<string, GraphEdge[]>();  // target -> edges

  /**
   * Index a memory item in the graph
   */
  async index(key: string, options: IndexOptions): Promise<void> {
    const node: GraphNode = {
      id: key,
      type: options.type,
      properties: {},
      tags: options.tags,
      createdAt: new Date(),
    };

    this.nodes.set(key, node);

    // Create edges for relations
    for (const rel of options.relations) {
      await this.addEdge(key, rel.target, rel.type);
    }
  }

  /**
   * Add an edge between two nodes
   */
  async addEdge(
    source: string,
    target: string,
    relation: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    // Ensure nodes exist
    if (!this.nodes.has(source)) {
      this.nodes.set(source, {
        id: source,
        type: 'unknown',
        properties: {},
        tags: [],
        createdAt: new Date(),
      });
    }

    if (!this.nodes.has(target)) {
      this.nodes.set(target, {
        id: target,
        type: 'unknown',
        properties: {},
        tags: [],
        createdAt: new Date(),
      });
    }

    const edge: GraphEdge = {
      source,
      target,
      relation,
      properties,
      createdAt: new Date(),
    };

    this.edges.push(edge);

    // Update indexes
    if (!this.outEdges.has(source)) {
      this.outEdges.set(source, []);
    }
    this.outEdges.get(source)!.push(edge);

    if (!this.inEdges.has(target)) {
      this.inEdges.set(target, []);
    }
    this.inEdges.get(target)!.push(edge);
  }

  /**
   * Traverse the graph from a starting node
   */
  async traverse(
    startKey: string,
    relation?: string,
    maxDepth: number = 2
  ): Promise<TraversalNode[]> {
    const visited = new Set<string>();
    const results: TraversalNode[] = [];
    const queue: TraversalNode[] = [{
      id: startKey,
      depth: 0,
      path: [startKey],
    }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.id)) continue;
      if (current.depth > maxDepth) continue;

      visited.add(current.id);

      if (current.depth > 0) {
        results.push(current);
      }

      // Get outgoing edges
      const edges = this.outEdges.get(current.id) || [];
      for (const edge of edges) {
        if (relation && edge.relation !== relation) continue;

        queue.push({
          id: edge.target,
          depth: current.depth + 1,
          path: [...current.path, edge.target],
          relation: edge.relation,
        });
      }

      // Get incoming edges (for bidirectional traversal)
      const incomingEdges = this.inEdges.get(current.id) || [];
      for (const edge of incomingEdges) {
        if (relation && edge.relation !== relation) continue;

        queue.push({
          id: edge.source,
          depth: current.depth + 1,
          path: [...current.path, edge.source],
          relation: edge.relation,
        });
      }
    }

    return results;
  }

  /**
   * Remove a node and optionally cascade to related nodes
   */
  async removeNode(
    key: string,
    options: { cascade?: boolean } = {}
  ): Promise<void> {
    if (options.cascade) {
      // Find all connected nodes
      const connected = await this.traverse(key, undefined, 1);
      for (const node of connected) {
        await this.removeNode(node.id, { cascade: false });
      }
    }

    // Remove edges
    this.edges = this.edges.filter(e => e.source !== key && e.target !== key);
    this.outEdges.delete(key);
    this.inEdges.delete(key);

    // Update remaining edge indexes
    for (const [source, edges] of Array.from(this.outEdges)) {
      this.outEdges.set(source, edges.filter(e => e.target !== key));
    }
    for (const [target, edges] of Array.from(this.inEdges)) {
      this.inEdges.set(target, edges.filter(e => e.source !== key));
    }

    // Remove node
    this.nodes.delete(key);
  }

  /**
   * Find nodes by type
   */
  findByType(type: string): GraphNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  /**
   * Find nodes by tags
   */
  findByTags(tags: string[]): GraphNode[] {
    return Array.from(this.nodes.values()).filter(n =>
      tags.some(t => n.tags.includes(t))
    );
  }

  /**
   * Get all relations for a node
   */
  getRelations(key: string): { outgoing: GraphEdge[]; incoming: GraphEdge[] } {
    return {
      outgoing: this.outEdges.get(key) || [],
      incoming: this.inEdges.get(key) || [],
    };
  }

  /**
   * Find shortest path between two nodes
   */
  async findPath(source: string, target: string, maxDepth: number = 5): Promise<string[] | null> {
    const visited = new Set<string>();
    const queue: { id: string; path: string[] }[] = [{ id: source, path: [source] }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.id === target) {
        return current.path;
      }

      if (visited.has(current.id) || current.path.length > maxDepth) continue;
      visited.add(current.id);

      const edges = this.outEdges.get(current.id) || [];
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          queue.push({
            id: edge.target,
            path: [...current.path, edge.target],
          });
        }
      }
    }

    return null;
  }

  /**
   * Get graph statistics
   */
  stats(): { nodes: number; edges: number; types: string[] } {
    const types = new Set<string>();
    for (const node of Array.from(this.nodes.values())) {
      types.add(node.type);
    }

    return {
      nodes: this.nodes.size,
      edges: this.edges.length,
      types: Array.from(types),
    };
  }

  /**
   * Export graph for visualization
   */
  export(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }
}

export default KnowledgeGraph;
