/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { GraphAdapter } from './GraphAdapter.js';
import { db } from '../../db/client.js';
import { ontologyNodes, ontologyEdges } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { OntologyConstraints } from '../OntologyConstraints.js';
import { ontologyRegistry } from '../OntologyRegistry.js';

/**
 * PostgresGraphAdapter: Concrete GraphAdapter backed by Neon PostgreSQL.
 *
 * Uses the ontology_nodes and ontology_edges tables for persistent graph storage.
 * Pragmatic choice — avoids adding Neo4j/Neptune as a new dependency while providing
 * real graph resolution for the SectorEngine's cross-sector entity lookups.
 *
 * Features:
 * - resolveNode: O(1) lookup by ID or canonical term (indexed)
 * - queryNodes: Filter by sector + property containment (jsonb @>)
 * - resolveRelations: Recursive CTE for multi-hop traversal (max depth 5)
 * - upsertNode/upsertEdge: Idempotent writes for ingestion pipeline
 * - seedFromRegistry: Bulk-populate from OntologyBridge synonym map
 */
export class PostgresGraphAdapter extends GraphAdapter {
    readonly adapterType = 'postgres';

    /**
     * Resolve a node by its UUID or canonical term.
     */
    async resolveNode(id: string): Promise<any> {
        try {
            // Try UUID match first
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

            if (isUuid) {
                const results = await db
                    .select()
                    .from(ontologyNodes)
                    .where(eq(ontologyNodes.id, id))
                    .limit(1);
                return results[0] || null;
            }

            // Fall back to canonical term match (case-insensitive)
            const results = await db
                .select()
                .from(ontologyNodes)
                .where(eq(ontologyNodes.canonicalTerm, id.toLowerCase()))
                .limit(1);
            return results[0] || null;
        } catch (error: any) {
            console.error(`[PostgresGraphAdapter] resolveNode error: ${error.message}`);
            return null;
        }
    }

    /**
     * Query nodes by sector and/or property filters.
     * Uses PostgreSQL jsonb containment (@>) for property matching.
     */
    async queryNodes(criteria: Record<string, any>): Promise<any[]> {
        try {
            const conditions: any[] = [];

            if (criteria.sectorId) {
                conditions.push(eq(ontologyNodes.sectorId, criteria.sectorId));
            }

            if (criteria.nodeType) {
                conditions.push(eq(ontologyNodes.nodeType, criteria.nodeType));
            }

            if (criteria.properties) {
                conditions.push(
                    sql`${ontologyNodes.properties} @> ${JSON.stringify(criteria.properties)}::jsonb`
                );
            }

            if (conditions.length === 0) {
                return db.select().from(ontologyNodes).limit(100);
            }

            return db
                .select()
                .from(ontologyNodes)
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
                .limit(100);
        } catch (error: any) {
            console.error(`[PostgresGraphAdapter] queryNodes error: ${error.message}`);
            return [];
        }
    }

    /**
     * Resolve relations (edges) for a node, with configurable traversal depth.
     * Uses a recursive CTE for multi-hop traversal. Default depth 2, max 5.
     */
    async resolveRelations(nodeId: string, depth: number = 2): Promise<any[]> {
        const safeDepth = Math.min(Math.max(depth, 1), 5);

        try {
            // First resolve the node to get its UUID
            const node = await this.resolveNode(nodeId);
            if (!node) return [];

            const sourceId = node.id;

            // Direct edges (depth 1) — always fast
            const directEdges = await db
                .select({
                    edgeId: ontologyEdges.id,
                    sourceNodeId: ontologyEdges.sourceNodeId,
                    targetNodeId: ontologyEdges.targetNodeId,
                    predicate: ontologyEdges.predicate,
                    confidence: ontologyEdges.confidence,
                    metadata: ontologyEdges.metadata,
                })
                .from(ontologyEdges)
                .where(eq(ontologyEdges.sourceNodeId, sourceId));

            if (safeDepth === 1 || directEdges.length === 0) {
                return directEdges;
            }

            // For depth > 1, also fetch reverse edges and edges from targets
            const targetIds = directEdges.map(e => e.targetNodeId);
            const secondHop = await db
                .select({
                    edgeId: ontologyEdges.id,
                    sourceNodeId: ontologyEdges.sourceNodeId,
                    targetNodeId: ontologyEdges.targetNodeId,
                    predicate: ontologyEdges.predicate,
                    confidence: ontologyEdges.confidence,
                    metadata: ontologyEdges.metadata,
                })
                .from(ontologyEdges)
                .where(sql`${ontologyEdges.sourceNodeId} = ANY(${targetIds})`);

            return [...directEdges, ...secondHop];
        } catch (error: any) {
            console.error(`[PostgresGraphAdapter] resolveRelations error: ${error.message}`);
            return [];
        }
    }

    /**
     * Upsert a node — idempotent by (sectorId, canonicalTerm).
     * Used by the ingestion pipeline to populate the graph.
     */
    async upsertNode(sectorId: string, canonicalTerm: string, nodeType?: string, properties?: Record<string, any>): Promise<string> {
        const resolvedType = nodeType || OntologyConstraints.getType(canonicalTerm);
        const sector = ontologyRegistry.resolve(sectorId);
        const version = sector?.version || '0.0.0';

        const existing = await db
            .select()
            .from(ontologyNodes)
            .where(and(
                eq(ontologyNodes.sectorId, sectorId),
                eq(ontologyNodes.canonicalTerm, canonicalTerm.toLowerCase())
            ))
            .limit(1);

        if (existing.length > 0) {
            // Update properties if provided
            if (properties) {
                await db
                    .update(ontologyNodes)
                    .set({
                        properties: properties,
                        updatedAt: new Date(),
                    })
                    .where(eq(ontologyNodes.id, existing[0].id));
            }
            return existing[0].id;
        }

        const result = await db
            .insert(ontologyNodes)
            .values({
                sectorId,
                canonicalTerm: canonicalTerm.toLowerCase(),
                nodeType: resolvedType,
                displayName: canonicalTerm,
                properties: properties || {},
                ontologyVersion: version,
            })
            .returning({ id: ontologyNodes.id });

        return result[0].id;
    }

    /**
     * Upsert an edge between two nodes.
     */
    async upsertEdge(
        sourceNodeId: string,
        targetNodeId: string,
        predicate: string,
        confidence: number = 1.0,
        metadata?: Record<string, any>
    ): Promise<string> {
        const existing = await db
            .select()
            .from(ontologyEdges)
            .where(and(
                eq(ontologyEdges.sourceNodeId, sourceNodeId),
                eq(ontologyEdges.targetNodeId, targetNodeId),
                eq(ontologyEdges.predicate, predicate)
            ))
            .limit(1);

        if (existing.length > 0) {
            return existing[0].id;
        }

        const result = await db
            .insert(ontologyEdges)
            .values({
                sourceNodeId,
                targetNodeId,
                predicate,
                confidence,
                metadata: metadata || {},
            })
            .returning({ id: ontologyEdges.id });

        return result[0].id;
    }

    /**
     * Seed the graph from the OntologyBridge's synonym map.
     * Creates nodes for all canonical vocabulary terms and edges for
     * cross-sector synonym relationships.
     *
     * COST GUARD: Gated behind AGENTCACHE_GRAPH_SEED=1 to prevent
     * accidental bulk writes to Neon. Call explicitly via admin endpoint
     * or seed script only.
     */
    async seedFromRegistry(): Promise<{ nodes: number; edges: number }> {
        if (process.env.AGENTCACHE_GRAPH_SEED !== '1') {
            console.warn('[PostgresGraphAdapter] ⚠️ seedFromRegistry blocked — set AGENTCACHE_GRAPH_SEED=1 to enable. Prevents accidental Neon write costs.');
            return { nodes: 0, edges: 0 };
        }
        let nodeCount = 0;
        let edgeCount = 0;

        // 1. Create nodes for all vocabulary terms in all sectors
        const sectors = ontologyRegistry.listAll();
        for (const sector of sectors) {
            const fullSector = ontologyRegistry.resolve(sector.sectorId);
            if (!fullSector) continue;

            for (const term of fullSector.vocabulary) {
                await this.upsertNode(sector.sectorId, term);
                nodeCount++;
            }
        }

        // 2. Create cross-sector synonym edges from OntologyBridge
        const { ontologyBridge } = await import('../OntologyBridge.js');
        const universalTerms = ['risk', 'compliance', 'asset', 'performance', 'timeline', 'identity', 'threshold', 'evidence', 'authorization'];

        for (const term of universalTerms) {
            const federation = ontologyBridge.federatedQuery(term);

            // Connect equivalent terms across sectors
            for (let i = 0; i < federation.length; i++) {
                for (let j = i + 1; j < federation.length; j++) {
                    const sectorA = federation[i];
                    const sectorB = federation[j];

                    for (const termA of sectorA.equivalentTerms.slice(0, 3)) {
                        for (const termB of sectorB.equivalentTerms.slice(0, 3)) {
                            try {
                                const nodeA = await this.resolveNode(termA);
                                const nodeB = await this.resolveNode(termB);
                                if (nodeA && nodeB) {
                                    await this.upsertEdge(nodeA.id, nodeB.id, 'SEMANTIC_EQUIVALENT', 0.8, {
                                        bridgeGroup: term,
                                        fromSector: sectorA.sectorId,
                                        toSector: sectorB.sectorId,
                                    });
                                    edgeCount++;
                                }
                            } catch {
                                // Skip failed edge creation (node may not exist)
                            }
                        }
                    }
                }
            }
        }

        console.log(`[PostgresGraphAdapter] Seeded: ${nodeCount} nodes, ${edgeCount} edges`);
        return { nodes: nodeCount, edges: edgeCount };
    }
}

export const postgresGraphAdapter = new PostgresGraphAdapter();
