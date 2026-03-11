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
 * AgentMemory: Unified 4-Layer Storage for Autonomous Agents
 * 
 * The brain's memory system - providing agents with:
 * 1. Semantic Memory (Vector) - Embeddings, similarity search, semantic recall
 * 2. Structured Memory (Relational) - Configs, policies, relationships
 * 3. Blob Memory (Object) - Large artifacts, media, snapshots
 * 4. Context Memory (KV) - High-velocity working memory, sub-10ms
 * 
 * API designed for agents:
 *   await memory.store(key, value, options)
 *   await memory.recall(query, options)
 *   await memory.forget(key, options)
 *   await memory.share(targetAgent, key, options)
 */

import { SemanticLayer } from './layers/semantic.js';
import { StructuredLayer } from './layers/structured.js';
import { BlobLayer } from './layers/blob.js';
import { ContextLayer } from './layers/context.js';
import { KnowledgeGraph } from './graph.js';
import { MemoryPolicy, PolicyEngine } from './policy.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MemoryOptions {
  namespace?: string;        // Isolation boundary
  semantic?: boolean;        // Auto-embed for similarity search
  ttl?: number;              // Time-to-live in seconds
  tier?: 'hot' | 'warm' | 'cold';  // Storage tier hint
  tags?: string[];           // Metadata tags
  acl?: string[];            // Access control list (agent IDs)
  graph?: boolean;           // Index in knowledge graph
}

export interface RecallOptions {
  semantic?: boolean;        // Use semantic search
  limit?: number;            // Max results
  threshold?: number;        // Similarity threshold (0-1)
  tags?: string[];           // Filter by tags
  before?: Date;             // Time filter
  after?: Date;              // Time filter
  includeMetadata?: boolean; // Return full metadata
}

export interface MemoryRecord {
  key: string;
  value: any;
  embedding?: number[];
  metadata: {
    namespace: string;
    createdAt: Date;
    updatedAt: Date;
    accessCount: number;
    lastAccess: Date;
    tier: 'hot' | 'warm' | 'cold';
    ttl?: number;
    tags: string[];
    checksum: string;
    size: number;
  };
}

export interface RecallResult {
  key: string;
  value: any;
  score?: number;           // Similarity score for semantic recall
  metadata?: MemoryRecord['metadata'];
}

export interface ShareOptions {
  permissions: 'read' | 'write' | 'admin';
  expiry?: Date;
  notify?: boolean;
}

// ============================================================================
// AGENT MEMORY CLASS
// ============================================================================

export class AgentMemory {
  private agentId: string;
  private namespace: string;

  // Storage layers
  private semantic: SemanticLayer;
  private structured: StructuredLayer;
  private blob: BlobLayer;
  private context: ContextLayer;
  private graph: KnowledgeGraph;
  private policy: PolicyEngine;

  constructor(agentId: string, namespace?: string) {
    this.agentId = agentId;
    this.namespace = namespace || `agent:${agentId}`;

    // Initialize layers
    this.semantic = new SemanticLayer();
    this.structured = new StructuredLayer();
    this.blob = new BlobLayer();
    this.context = new ContextLayer();
    this.graph = new KnowledgeGraph();
    this.policy = new PolicyEngine();
  }

  // ==========================================================================
  // STORE - Write to appropriate layer(s)
  // ==========================================================================

  async store(key: string, value: any, options: MemoryOptions = {}): Promise<MemoryRecord> {
    const fullKey = this.makeKey(key);
    const tier = options.tier || this.inferTier(value);
    const now = new Date();

    // Check policy
    await this.policy.checkWrite(this.agentId, fullKey, options);

    // Determine value type and size
    const serialized = this.serialize(value);
    const size = Buffer.byteLength(serialized, 'utf8');
    const checksum = this.checksum(serialized);

    // Build metadata
    const metadata: MemoryRecord['metadata'] = {
      namespace: options.namespace || this.namespace,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccess: now,
      tier,
      ttl: options.ttl,
      tags: options.tags || [],
      checksum,
      size,
    };

    let embedding: number[] | undefined;

    // Layer routing based on options and data characteristics
    if (options.semantic !== false && this.shouldEmbed(value)) {
      // Semantic layer - generate embedding
      embedding = await this.semantic.embed(this.extractText(value));
      await this.semantic.store(fullKey, embedding, metadata);
    }

    if (tier === 'hot' || size < 64 * 1024) {
      // Context layer (KV) for hot data < 64KB
      await this.context.set(fullKey, serialized, options.ttl);
    }

    if (size > 1024 * 1024 || this.isBlob(value)) {
      // Blob layer for large objects > 1MB or explicit blobs
      await this.blob.put(fullKey, value, metadata);
    } else {
      // Structured layer for everything else
      await this.structured.upsert(fullKey, value, metadata);
    }

    // Knowledge graph indexing
    if (options.graph !== false) {
      await this.graph.index(fullKey, {
        type: this.inferType(value),
        tags: options.tags || [],
        relations: this.extractRelations(value),
      });
    }

    const record: MemoryRecord = {
      key: fullKey,
      value,
      embedding,
      metadata,
    };

    // Emit event for observability
    this.emit('store', record);

    return record;
  }

  // ==========================================================================
  // RECALL - Retrieve from appropriate layer(s)
  // ==========================================================================

  async recall(query: string, options: RecallOptions = {}): Promise<RecallResult[]> {
    const limit = options.limit || 10;
    const results: RecallResult[] = [];

    // Check policy
    await this.policy.checkRead(this.agentId, query, options);

    if (options.semantic !== false) {
      // Semantic search
      const embedding = await this.semantic.embed(query);
      const semanticResults = await this.semantic.search(
        embedding,
        this.namespace,
        limit,
        options.threshold || 0.7
      );

      for (const hit of semanticResults) {
        // Retrieve full value from appropriate layer
        const value = await this.getValue(hit.key);
        if (value !== null) {
          results.push({
            key: hit.key,
            value,
            score: hit.score,
            metadata: options.includeMetadata ? await this.getMetadata(hit.key) : undefined,
          });
        }
      }
    }

    // Exact key lookup
    if (this.looksLikeKey(query)) {
      const fullKey = this.makeKey(query);
      const value = await this.getValue(fullKey);
      if (value !== null) {
        results.unshift({
          key: fullKey,
          value,
          score: 1.0,
          metadata: options.includeMetadata ? await this.getMetadata(fullKey) : undefined,
        });
      }
    }

    // Tag-based search
    if (options.tags && options.tags.length > 0) {
      const tagResults = await this.structured.findByTags(
        this.namespace,
        options.tags,
        limit
      );
      for (const record of tagResults) {
        if (!results.find(r => r.key === record.key)) {
          results.push({
            key: record.key,
            value: record.value,
            metadata: options.includeMetadata ? (record.metadata as MemoryRecord['metadata']) : undefined,
          });
        }
      }
    }

    // Update access stats
    for (const result of results) {
      await this.recordAccess(result.key);
    }

    this.emit('recall', { query, results: results.length });

    return results.slice(0, limit);
  }

  // ==========================================================================
  // FORGET - Remove from all layers with policy checks
  // ==========================================================================

  async forget(key: string, options: { force?: boolean; cascade?: boolean } = {}): Promise<boolean> {
    const fullKey = this.makeKey(key);

    // Check policy
    const canForget = await this.policy.checkDelete(this.agentId, fullKey, options);
    if (!canForget && !options.force) {
      throw new Error(`Policy prevents deletion of ${key}`);
    }

    // Remove from all layers
    await Promise.all([
      this.context.delete(fullKey),
      this.semantic.delete(fullKey),
      this.structured.delete(fullKey),
      this.blob.delete(fullKey),
    ]);

    // Cascade to graph
    if (options.cascade) {
      await this.graph.removeNode(fullKey, { cascade: true });
    } else {
      await this.graph.removeNode(fullKey);
    }

    this.emit('forget', { key: fullKey, cascade: options.cascade });

    return true;
  }

  // ==========================================================================
  // SHARE - Cross-agent memory sharing
  // ==========================================================================

  async share(
    targetAgentId: string,
    key: string,
    options: ShareOptions = { permissions: 'read' }
  ): Promise<{ shareId: string; accessUrl: string }> {
    const fullKey = this.makeKey(key);

    // Check policy
    await this.policy.checkShare(this.agentId, targetAgentId, fullKey, options);

    // Create share record
    const shareId = `share:${this.agentId}:${targetAgentId}:${Date.now()}`;

    await this.structured.upsert(shareId, {
      sourceAgent: this.agentId,
      targetAgent: targetAgentId,
      key: fullKey,
      permissions: options.permissions,
      expiry: options.expiry,
      createdAt: new Date(),
    }, {
      namespace: 'system:shares',
      createdAt: new Date(),
      updatedAt: new Date(),
      accessCount: 0,
      lastAccess: new Date(),
      tier: 'hot',
      tags: ['share', this.agentId, targetAgentId],
      checksum: '',
      size: 0,
    });

    // Add graph edge
    await this.graph.addEdge(
      `agent:${this.agentId}`,
      `agent:${targetAgentId}`,
      'shared_memory',
      { key: fullKey, permissions: options.permissions }
    );

    // Notify target agent if requested
    if (options.notify) {
      await this.notifyAgent(targetAgentId, 'memory_shared', {
        from: this.agentId,
        key: fullKey,
        shareId,
      });
    }

    this.emit('share', { shareId, targetAgentId, key: fullKey });

    return {
      shareId,
      accessUrl: `agentcache://memory/${shareId}`,
    };
  }

  // ==========================================================================
  // GRAPH OPERATIONS - Knowledge graph queries
  // ==========================================================================

  async link(sourceKey: string, targetKey: string, relation: string, properties?: Record<string, any>): Promise<void> {
    const fullSource = this.makeKey(sourceKey);
    const fullTarget = this.makeKey(targetKey);
    await this.graph.addEdge(fullSource, fullTarget, relation, properties);
  }

  async findRelated(key: string, relation?: string, depth: number = 1): Promise<RecallResult[]> {
    const fullKey = this.makeKey(key);
    const nodes = await this.graph.traverse(fullKey, relation, depth);

    const results: RecallResult[] = [];
    for (const node of nodes) {
      const value = await this.getValue(node.id);
      if (value !== null) {
        results.push({
          key: node.id,
          value,
          score: 1 / (node.depth + 1), // Closer = higher score
        });
      }
    }
    return results;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private makeKey(key: string): string {
    if (key.startsWith(this.namespace)) return key;
    return `${this.namespace}:${key}`;
  }

  private async getValue(key: string): Promise<any | null> {
    // Try layers in order of speed
    let value = await this.context.get(key);
    if (value !== null) return this.deserialize(value);

    value = await this.structured.get(key);
    if (value !== null) return value;

    value = await this.blob.get(key) as any;
    return value;
  }

  private async getMetadata(key: string): Promise<MemoryRecord['metadata'] | undefined> {
    return this.structured.getMetadata(key) as Promise<MemoryRecord['metadata'] | undefined>;
  }

  private async recordAccess(key: string): Promise<void> {
    await this.structured.incrementAccess(key);
  }

  private inferTier(value: any): 'hot' | 'warm' | 'cold' {
    const size = Buffer.byteLength(this.serialize(value), 'utf8');
    if (size < 4 * 1024) return 'hot';      // < 4KB
    if (size < 256 * 1024) return 'warm';   // < 256KB
    return 'cold';                           // >= 256KB
  }

  private shouldEmbed(value: any): boolean {
    // Embed text-like content
    if (typeof value === 'string') return value.length > 10;
    if (typeof value === 'object' && value !== null) {
      const text = this.extractText(value);
      return text.length > 20;
    }
    return false;
  }

  private extractText(value: any): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      // Extract text fields
      const textFields = ['text', 'content', 'message', 'description', 'body', 'title', 'name'];
      for (const field of textFields) {
        if (value[field] && typeof value[field] === 'string') {
          return value[field];
        }
      }
      return JSON.stringify(value);
    }
    return String(value);
  }

  private extractRelations(value: any): Array<{ target: string; type: string }> {
    const relations: Array<{ target: string; type: string }> = [];
    if (typeof value === 'object' && value !== null) {
      // Look for reference fields
      const refFields = ['parent', 'source', 'target', 'ref', 'link', 'related', 'depends_on'];
      for (const field of refFields) {
        if (value[field]) {
          relations.push({
            target: String(value[field]),
            type: field,
          });
        }
      }
    }
    return relations;
  }

  private inferType(value: any): string {
    if (typeof value === 'string') return 'text';
    if (Array.isArray(value)) return 'list';
    if (value instanceof Buffer) return 'binary';
    if (typeof value === 'object' && value !== null) {
      if (value.type) return String(value.type);
      return 'object';
    }
    return typeof value;
  }

  private isBlob(value: any): boolean {
    return value instanceof Buffer ||
      value instanceof Uint8Array ||
      (typeof value === 'object' && value?.type === 'blob');
  }

  private serialize(value: any): string {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  private deserialize(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private checksum(data: string): string {
    // Simple hash for integrity checking
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private looksLikeKey(query: string): boolean {
    // Check if query looks like a key rather than a search query
    return query.includes(':') || query.includes('/') || !query.includes(' ');
  }

  private emit(event: string, data: any): void {
    // Event emission for observability
    console.log(`[AgentMemory:${this.agentId}] ${event}`, data);
  }

  private async notifyAgent(agentId: string, event: string, data: any): Promise<void> {
    // Notification system - to be implemented with pub/sub
    console.log(`[AgentMemory] Notify ${agentId}: ${event}`, data);
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

const memoryInstances = new Map<string, AgentMemory>();

export function getMemory(agentId: string, namespace?: string): AgentMemory {
  const key = `${agentId}:${namespace || 'default'}`;
  if (!memoryInstances.has(key)) {
    memoryInstances.set(key, new AgentMemory(agentId, namespace));
  }
  return memoryInstances.get(key)!;
}

export default AgentMemory;
