import { z } from 'zod';
import { ontologyRegistry } from './OntologyRegistry.js';
import { ontologyService } from '../services/OntologyService.js';

/**
 * DataLakeSource: Describes where raw data lives.
 */
export interface DataLakeSource {
    type: 'http' | 's3' | 'raw';
    uri?: string;           // URL or S3 path (for http/s3 types)
    data?: string | object; // Inline data (for raw type)
    format?: 'json' | 'csv' | 'markdown' | 'parquet';
}

/**
 * DataLakeResult: The structured output of an ingestion + mapping.
 */
export interface DataLakeResult {
    sectorId: string;
    sourceType: string;
    mappedData: any;
    latencyMs: number;
    rawBytesIngested: number;
    timestamp: string;
}

/**
 * DataLakeConnector: Abstract base class for ingesting data from various
 * lake formats and mapping through the OntologyService.
 * 
 * Concrete connectors (HttpConnector, S3Connector, RawConnector) handle
 * the retrieval; this class orchestrates the ontology mapping.
 */
export abstract class DataLakeConnector {
    /**
     * Retrieve raw data from the source. Implemented by concrete connectors.
     */
    abstract ingest(source: DataLakeSource): Promise<string>;

    /**
     * Full pipeline: ingest from source → resolve sector schema → map via OntologyService → return typed result.
     */
    async ingestAndMap(source: DataLakeSource, sectorId: string): Promise<DataLakeResult> {
        const startTime = Date.now();

        // 1. Resolve the target schema from the registry
        const sector = ontologyRegistry.resolve(sectorId);
        if (!sector) {
            throw new Error(`[DataLakeConnector] Unknown sector: "${sectorId}". Use GET /api/ontology/schemas for available sectors.`);
        }

        // 2. Ingest raw data from the source
        const rawData = await this.ingest(source);
        const rawBytes = Buffer.byteLength(rawData, 'utf-8');

        console.log(`[DataLakeConnector] Ingested ${rawBytes} bytes from ${source.type} source. Mapping to ${sectorId}...`);

        // 3. Truncate for LLM context window (match ExcavationService pattern)
        const maxChars = 30000;
        const truncated = rawData.length > maxChars
            ? rawData.substring(0, maxChars) + '\n...[TRUNCATED]'
            : rawData;

        // 4. Map through OntologyService using the sector schema
        const mappedData = await ontologyService.semanticMap(truncated, sector.schema);

        const latency = Date.now() - startTime;

        return {
            sectorId,
            sourceType: source.type,
            mappedData,
            latencyMs: latency,
            rawBytesIngested: rawBytes,
            timestamp: new Date().toISOString(),
        };
    }
}
