import { Hono } from 'hono';
import { ontologyService } from '../services/OntologyService.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { z } from 'zod';
import { excavationService, CompanyProfileSchema } from '../services/ExcavationService.js';
import { ontologyRegistry } from '../ontology/OntologyRegistry.js';
import { ontologyBridge } from '../ontology/OntologyBridge.js';
import { ontologyCacheStrategy } from '../ontology/OntologyCacheStrategy.js';
import { httpConnector } from '../ontology/connectors/HttpConnector.js';
import { s3Connector } from '../ontology/connectors/S3Connector.js';
import { rawConnector } from '../ontology/connectors/RawConnector.js';

const ontologyRouter = new Hono();

const OntologyMapSchema = z.object({
    sourceData: z.union([z.string(), z.record(z.string(), z.any())]),
    targetSchema: z.record(z.string(), z.any()),
    sectorId: z.string().optional(),
    schemaVersion: z.string().optional(), // Pin to a specific schema version (e.g., '1.0.0')
});

// ─────────────────────────────────────────────
//  POST /api/ontology/map
//  Semantic map with optional sector-aware caching
// ─────────────────────────────────────────────
ontologyRouter.post('/map', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const parsed = OntologyMapSchema.safeParse(body);

        if (!parsed.success) {
            return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
        }

        const { sourceData, targetSchema, sectorId, schemaVersion } = parsed.data;

        const startTime = Date.now();
        const mappedData = await ontologyService.semanticMap(sourceData, targetSchema, sectorId, schemaVersion);
        const latency = Date.now() - startTime;

        return c.json({
            success: true,
            mappedData,
            sectorId: sectorId || 'generic',
            latencyMs: latency,
            engine: 'mercury'
        });
    } catch (error: any) {
        console.error('[Ontology API Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

// ─────────────────────────────────────────────
//  POST /api/ontology/excavate
//  Sector-aware URL excavation via registry
// ─────────────────────────────────────────────
ontologyRouter.post('/excavate', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const url = body.url;
        const sectorId = body.sector || body.targetType; // Support both new and legacy param

        if (!url || typeof url !== 'string') {
            return c.json({ error: 'Valid URL is required' }, 400);
        }

        // Legacy support: 'CompanyProfile' targetType still works
        if (sectorId === 'CompanyProfile' || !sectorId) {
            const result = await excavationService.excavateUrl(url, CompanyProfileSchema);
            return c.json({ success: true, excavation: result });
        }

        // New: sector-based resolution
        const sector = ontologyRegistry.resolve(sectorId);
        if (!sector) {
            return c.json({
                error: `Unknown sector: "${sectorId}"`,
                available: ontologyRegistry.listAll().map(s => s.sectorId)
            }, 400);
        }

        const result = await excavationService.excavateUrl(url, undefined, sectorId);

        return c.json({
            success: true,
            excavation: result
        });
    } catch (error: any) {
        console.error('[Ontology Excavate API Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

// ─────────────────────────────────────────────
//  GET /api/ontology/schemas
//  Discovery endpoint — agents use this to learn available ontologies
// ─────────────────────────────────────────────
ontologyRouter.get('/schemas', async (c) => {
    const schemas = ontologyRegistry.listAll();

    return c.json({
        success: true,
        count: schemas.length,
        schemas,
        _links: {
            excavate: 'POST /api/ontology/excavate { url, sector }',
            ingest: 'POST /api/ontology/ingest { source, sector }',
            bridge: 'POST /api/ontology/bridge { term, fromSector?, toSector? }',
        }
    });
});

// ─────────────────────────────────────────────
//  POST /api/ontology/ingest
//  Data lake ingestion — accepts source descriptor + sector
// ─────────────────────────────────────────────
const IngestSchema = z.object({
    source: z.object({
        type: z.enum(['http', 's3', 'raw']),
        uri: z.string().optional(),
        data: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
        format: z.enum(['json', 'csv', 'markdown', 'parquet']).optional(),
    }),
    sector: z.string(),
});

ontologyRouter.post('/ingest', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const parsed = IngestSchema.safeParse(body);

        if (!parsed.success) {
            return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
        }

        const { source, sector } = parsed.data;

        // Validate sector existence
        const sectorEntry = ontologyRegistry.resolve(sector);
        if (!sectorEntry) {
            return c.json({
                error: `Unknown sector: "${sector}"`,
                available: ontologyRegistry.listAll().map(s => s.sectorId)
            }, 400);
        }

        // Select connector based on source type
        let connector;
        switch (source.type) {
            case 'http':
                connector = httpConnector;
                break;
            case 's3':
                connector = s3Connector;
                break;
            case 'raw':
                connector = rawConnector;
                break;
            default:
                return c.json({ error: `Unsupported source type: ${source.type}` }, 400);
        }

        const result = await connector.ingestAndMap(source, sector);

        return c.json({
            success: true,
            ingestion: result,
        });
    } catch (error: any) {
        console.error('[Ontology Ingest API Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

// ─────────────────────────────────────────────
//  POST /api/ontology/bridge
//  Cross-sector term federation
// ─────────────────────────────────────────────
const BridgeSchema = z.object({
    term: z.string(),
    fromSector: z.string().optional(),
    toSector: z.string().optional(),
});

ontologyRouter.post('/bridge', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const parsed = BridgeSchema.safeParse(body);

        if (!parsed.success) {
            return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
        }

        const { term, fromSector, toSector } = parsed.data;

        // If both from/to sectors are specified, do a direct bridge
        if (fromSector && toSector) {
            const equivalents = ontologyBridge.bridge(term, fromSector, toSector);
            return c.json({
                success: true,
                term,
                fromSector,
                toSector,
                equivalentTerms: equivalents,
            });
        }

        // Otherwise, do a full federated query across all sectors
        const federation = ontologyBridge.federatedQuery(term);

        return c.json({
            success: true,
            term,
            federatedResults: federation,
            sectorsMatched: federation.length,
        });
    } catch (error: any) {
        console.error('[Ontology Bridge API Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

// ─────────────────────────────────────────────
//  GET /api/ontology/metrics/:sector
//  Cache performance metrics per sector
// ─────────────────────────────────────────────
ontologyRouter.get('/metrics/:sector', async (c) => {
    const sector = c.req.param('sector');

    if (!ontologyRegistry.resolve(sector)) {
        return c.json({ error: `Unknown sector: "${sector}"` }, 404);
    }

    const metrics = await ontologyCacheStrategy.getMetrics(sector);

    return c.json({
        success: true,
        sector,
        cacheMetrics: metrics,
    });
});

// ─────────────────────────────────────────────
//  GET /api/ontology/openapi.json
//  Machine-readable OpenAPI 3.1 spec
// ─────────────────────────────────────────────
ontologyRouter.get('/openapi.json', async (c) => {
    const sectors = ontologyRegistry.listAll();

    const spec = {
        openapi: '3.1.0',
        info: {
            title: 'AgentCache Data Lake Ontology API',
            version: '1.0.0',
            description: 'Ingest unstructured data, map to industry-standard schemas, and federate queries across 6 sectors.',
            contact: { url: 'https://agentcache.ai' },
        },
        servers: [{ url: 'https://agentcache.ai' }],
        paths: {
            '/api/ontology/schemas': {
                get: {
                    summary: 'List all registered sector ontologies',
                    responses: { '200': { description: 'Array of sector schemas with fields and TTLs' } },
                },
            },
            '/api/ontology/map': {
                post: {
                    summary: 'Map source data to a target schema',
                    requestBody: {
                        content: { 'application/json': { schema: { type: 'object', properties: {
                            sourceData: { oneOf: [{ type: 'string' }, { type: 'object' }] },
                            targetSchema: { type: 'object' },
                            sectorId: { type: 'string', enum: sectors.map(s => s.sectorId) },
                            schemaVersion: { type: 'string' },
                        }, required: ['sourceData', 'targetSchema'] } } },
                    },
                    responses: { '200': { description: 'Mapped data conforming to target schema' } },
                },
            },
            '/api/ontology/excavate': {
                post: {
                    summary: 'Scrape a URL and map to sector ontology',
                    requestBody: {
                        content: { 'application/json': { schema: { type: 'object', properties: {
                            url: { type: 'string', format: 'uri' },
                            sector: { type: 'string', enum: sectors.map(s => s.sectorId) },
                        }, required: ['url'] } } },
                    },
                    responses: { '200': { description: 'Excavated and mapped data' } },
                },
            },
            '/api/ontology/ingest': {
                post: {
                    summary: 'Ingest from data lake source (HTTP, S3, or raw)',
                    requestBody: {
                        content: { 'application/json': { schema: { type: 'object', properties: {
                            source: { type: 'object', properties: {
                                type: { type: 'string', enum: ['http', 's3', 'raw'] },
                                uri: { type: 'string' },
                                data: { oneOf: [{ type: 'string' }, { type: 'object' }] },
                            }, required: ['type'] },
                            sector: { type: 'string', enum: sectors.map(s => s.sectorId) },
                        }, required: ['source', 'sector'] } } },
                    },
                    responses: { '200': { description: 'Ingested and mapped data' } },
                },
            },
            '/api/ontology/bridge': {
                post: {
                    summary: 'Cross-sector term federation',
                    description: 'Query a concept and get equivalent terms across all sectors',
                    requestBody: {
                        content: { 'application/json': { schema: { type: 'object', properties: {
                            term: { type: 'string' },
                            fromSector: { type: 'string' },
                            toSector: { type: 'string' },
                        }, required: ['term'] } } },
                    },
                    responses: { '200': { description: 'Federated results with equivalent terms per sector' } },
                },
            },
        },
        components: {
            securitySchemes: {
                apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
                x402: { type: 'apiKey', in: 'header', name: 'Preauthorization', description: 'x402 agentic payment receipt' },
            },
        },
        security: [{ apiKey: [] }, { x402: [] }],
    };

    return c.json(spec);
});

export default ontologyRouter;
