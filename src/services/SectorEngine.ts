
import { SectorOntology } from '../ontology/OntologyRegistry.js';
import { DataLakeConnector } from '../ontology/DataLakeConnector.js';
import { GraphAdapter } from '../ontology/connectors/GraphAdapter.js';
import { semanticBusService } from './SemanticBusService.js';

export interface SectorWiring {
    ontology: SectorOntology;
    connector: DataLakeConnector;
    graphAdapter: GraphAdapter;
}

/**
 * SectorEngine: The Production Wiring Factory
 * 
 * Orchestrates the integration of industry-specific logic. 
 * Designed for modularity, observability, and high-performance throughput.
 * 
 * AWS-Grade features:
 * - Decoupled I/O via Adapter Pattern.
 * - Reactive pipeline for bus-to-graph synchronization.
 * - Centralized lifecycle management for sector-specific streams.
 */
export class SectorEngine {
    private activeSectors: Map<string, SectorWiring> = new Map();

    /**
     * Ignite a sector engine, connecting its ontology and data sources to the bus.
     */
    async ignite(sectorId: string, wiring: SectorWiring): Promise<void> {
        console.log(`[SectorEngine] 🔥 Igniting engine for sector: ${sectorId}`);
        
        // 1. Register wiring
        this.activeSectors.set(sectorId, wiring);

        // 2. Setup Data Lake Listeners (Reactive Bridge)
        wiring.connector.onData(async (payload) => {
            console.log(`[SectorEngine] 📥 Ingesting data for ${sectorId}`);
            
            // Push to Semantic Bus for entity extraction and resonance
            await semanticBusService.publish({
                sector: sectorId.toUpperCase(),
                content: JSON.stringify(payload),
                ontologyRef: `${wiring.ontology.sectorId}@${wiring.ontology.version}`
            });
        });

        console.log(`[SectorEngine] ✅ ${sectorId} wired and operational.`);
    }

    /**
     * Retrieve the active wiring for a sector.
     */
    getWiring(sectorId: string): SectorWiring | undefined {
        return this.activeSectors.get(sectorId);
    }

    /**
     * Resolve cross-sector entities through the graph adapters.
     */
    /**
     * Resolve cross-sector entities through the graph adapters and ontology bridge.
     */
    async resolveCrossSector(entityId: string, fromSector: string, toSector: string): Promise<any> {
        const fromWiring = this.getWiring(fromSector);
        const toWiring = this.getWiring(toSector);

        if (!fromWiring || !toWiring) {
            console.warn(`[SectorEngine] Missing wiring for cross-sector resolution: ${fromSector} -> ${toSector}`);
            return null;
        }

        // 1. Resolve starting node in 'fromSector'
        const startNode = await fromWiring.graphAdapter.resolveNode(entityId);
        if (!startNode) return null;

        // 2. Lookup global synonyms/links via OntologyBridge
        const { ontologyBridge } = await import('../ontology/OntologyBridge.js');
        const synonyms = ontologyBridge.federatedQuery(entityId);
        const targetSectorSynonym = synonyms.find(s => s.sectorId === toSector);

        if (!targetSectorSynonym) {
            // No direct link found in ontology bridge
            return {
                source: startNode,
                target: null,
                bridge: "No semantic link found between sectors"
            };
        }

        // 3. Resolve linked node in 'toSector' (using the first equivalent term)
        const targetTerm = targetSectorSynonym.equivalentTerms[0] || entityId;
        const targetNode = await toWiring.graphAdapter.resolveNode(targetTerm);

        return {
            source: startNode,
            target: targetNode,
            bridge: "Ontology-Federated-Link"
        };
    }
}

export const sectorEngine = new SectorEngine();
