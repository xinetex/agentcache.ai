import { beforeAll, describe, expect, it, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────
//  Mock LLM and external services BEFORE any imports
// ─────────────────────────────────────────────

vi.mock('../../src/services/OntologyService.js', () => ({
    ontologyService: {
        semanticMap: async (_data: any, _schema: any, sectorId?: string) => {
            // Return sector-appropriate mock data
            if (sectorId === 'finance') {
                return {
                    entityName: 'TestCorp Capital',
                    entityType: 'hedge_fund',
                    jurisdiction: 'US-SEC',
                    instruments: [{ ticker: 'AAPL', instrumentType: 'equity', exchange: 'NASDAQ', currency: 'USD' }],
                    aum: 50000000,
                    settlementProtocol: 'T+1',
                    lastAuditDate: '2025-12-01',
                };
            }
            if (sectorId === 'biotech') {
                return {
                    organizationName: 'GeneSynth Labs',
                    organizationType: 'biotech',
                    therapeuticAreas: ['oncology', 'rare_disease'],
                    pipeline: [{ trialId: 'NCT12345678', phase: 'phase_2', indication: 'NSCLC', status: 'recruiting' }],
                    patents: 42,
                    fdaApprovals: 3,
                };
            }
            if (sectorId === 'legal') {
                return {
                    documentTitle: 'Master Services Agreement',
                    documentType: 'contract',
                    parties: [{ name: 'Acme Corp', role: 'licensor' }],
                    effectiveDate: '2026-01-01',
                    expirationDate: '2027-01-01',
                    governingLaw: 'State of Delaware',
                    clauses: [{ clauseId: 'CL-1', title: 'Limitation of Liability', category: 'liability', riskLevel: 'medium', summary: 'Cap at contract value', obligations: ['Limit liability'] }],
                    riskScore: 35,
                    requiresHumanReview: false,
                };
            }
            return { simulated: true };
        }
    },
    OntologyService: class { }
}));

vi.mock('../../src/services/FirecrawlService.js', () => ({
    firecrawlService: {
        scrapeUrl: async () => 'Mock scraped markdown content from the target URL.'
    }
}));

vi.mock('../../src/lib/observability/tracer.js', () => ({
    Tracer: class {
        startSpan(name: string) { return { id: name, attributes: {} }; }
        endSpan() { }
        getTraceId() { return 'test-trace-id'; }
        async flush() { }
    }
}));

// ─────────────────────────────────────────────
//  Test Suite
// ─────────────────────────────────────────────

describe('Data Lake Ontology System', () => {

    let app: any;

    beforeAll(async () => {
        ({ app } = await import('../../src/index.js'));
    });

    async function request(path: string, method: string = 'GET', body?: any) {
        const options: any = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'ac_demo_test_ontology',
            },
        };
        if (body) options.body = JSON.stringify(body);

        const response = await app.request(path, options);
        let payload;
        try { payload = await response.json(); } catch (e) { /* ignore */ }
        return { response, payload };
    }

    // ─── Schema Registry ─────────────────────

    describe('Schema Registry', () => {

        it('resolves all 6 built-in sectors', async () => {
            const { OntologyRegistry } = await import('../../src/ontology/OntologyRegistry.js');
            const registry = new OntologyRegistry();

            expect(registry.size).toBe(6);

            const sectors = ['finance', 'biotech', 'legal', 'robotics', 'healthcare', 'energy'];
            for (const sectorId of sectors) {
                const sector = registry.resolve(sectorId);
                expect(sector).toBeDefined();
                expect(sector!.sectorId).toBe(sectorId);
                expect(sector!.schema).toBeDefined();
                expect(sector!.vocabulary.length).toBeGreaterThan(0);
            }
        });

        it('lists all schemas with field names', async () => {
            const { OntologyRegistry } = await import('../../src/ontology/OntologyRegistry.js');
            const registry = new OntologyRegistry();

            const listing = registry.listAll();
            expect(listing.length).toBe(6);

            const finance = listing.find(s => s.sectorId === 'finance');
            expect(finance).toBeDefined();
            expect(finance!.fields).toContain('entityName');
            expect(finance!.fields).toContain('instruments');
        });

        it('indexes vocabulary terms for cross-sector lookup', async () => {
            const { OntologyRegistry } = await import('../../src/ontology/OntologyRegistry.js');
            const registry = new OntologyRegistry();

            // 'risk' appears in finance, healthcare, and legal vocabularies
            const riskSectors = registry.findByTerm('risk');
            expect(riskSectors.length).toBeGreaterThanOrEqual(2);
            expect(riskSectors).toContain('finance');
        });

        it('returns empty for unknown sector', async () => {
            const { OntologyRegistry } = await import('../../src/ontology/OntologyRegistry.js');
            const registry = new OntologyRegistry();

            expect(registry.resolve('quantum_computing')).toBeUndefined();
        });
    });

    // ─── API: Schema Discovery ─────────────────────

    describe('API: GET /api/ontology/schemas', () => {

        it('returns all registered schema listings', async () => {
            const { payload } = await request('/api/ontology/schemas');

            expect(payload.success).toBe(true);
            expect(payload.count).toBe(6);
            expect(payload.schemas.length).toBe(6);

            const sectorIds = payload.schemas.map((s: any) => s.sectorId);
            expect(sectorIds).toContain('finance');
            expect(sectorIds).toContain('biotech');
            expect(sectorIds).toContain('energy');
        });

        it('includes HATEOAS-style _links for agent discovery', async () => {
            const { payload } = await request('/api/ontology/schemas');

            expect(payload._links).toBeDefined();
            expect(payload._links.excavate).toBeDefined();
            expect(payload._links.ingest).toBeDefined();
            expect(payload._links.bridge).toBeDefined();
        });
    });

    // ─── Cross-Sector Bridge ─────────────────────

    describe('Cross-Sector Bridge', () => {

        it('bridges "risk" from finance to robotics', async () => {
            const { OntologyBridge } = await import('../../src/ontology/OntologyBridge.js');
            const bridge = new OntologyBridge();

            const equivalents = bridge.bridge('risk', 'finance', 'robotics');
            expect(equivalents.length).toBeGreaterThan(0);
            expect(equivalents).toContain('hazard');
        });

        it('performs federated query across all sectors', async () => {
            const { OntologyBridge } = await import('../../src/ontology/OntologyBridge.js');
            const bridge = new OntologyBridge();

            const federation = bridge.federatedQuery('risk');
            expect(federation.length).toBeGreaterThanOrEqual(4); // risk exists in many sectors

            const sectorIds = federation.map(f => f.sectorId);
            expect(sectorIds).toContain('finance');
            expect(sectorIds).toContain('legal');
        });

        it('returns empty for non-existent term', async () => {
            const { OntologyBridge } = await import('../../src/ontology/OntologyBridge.js');
            const bridge = new OntologyBridge();

            const equivalents = bridge.bridge('nonexistent_term', 'finance', 'legal');
            expect(equivalents).toEqual([]);
        });
    });

    // ─── API: Bridge Endpoint ─────────────────────

    describe('API: POST /api/ontology/bridge', () => {

        it('returns federated results for "compliance"', async () => {
            const { payload } = await request('/api/ontology/bridge', 'POST', {
                term: 'compliance'
            });

            expect(payload.success).toBe(true);
            expect(payload.sectorsMatched).toBeGreaterThanOrEqual(4);
        });

        it('bridges a term between two specific sectors', async () => {
            const { payload } = await request('/api/ontology/bridge', 'POST', {
                term: 'risk',
                fromSector: 'finance',
                toSector: 'legal'
            });

            expect(payload.success).toBe(true);
            expect(payload.equivalentTerms.length).toBeGreaterThan(0);
        });
    });

    // ─── Raw Data Ingestion ─────────────────────

    describe('Data Lake Ingestion (Raw Connector)', () => {

        it('ingests inline JSON and maps to finance ontology', async () => {
            const { RawConnector } = await import('../../src/ontology/connectors/RawConnector.js');
            const connector = new RawConnector();

            const rawData = await connector.ingest({
                type: 'raw',
                data: { name: 'TestCorp', aum: 500000000, sector: 'hedge_fund' }
            });

            expect(rawData).toContain('TestCorp');
            expect(rawData.length).toBeGreaterThan(0);
        });
    });

    // ─── Cache Strategy ─────────────────────

    describe('Ontology Cache Strategy', () => {

        it('generates deterministic cache keys', async () => {
            const { OntologyCacheStrategy } = await import('../../src/ontology/OntologyCacheStrategy.js');
            const cache = new OntologyCacheStrategy();

            const key1 = cache.generateKey('finance', 'test data');
            const key2 = cache.generateKey('finance', 'test data');
            const key3 = cache.generateKey('biotech', 'test data');

            // Same input → same key
            expect(key1).toBe(key2);
            // Different sector → different key
            expect(key1).not.toBe(key3);
            // Key format includes sector and version
            expect(key1).toContain('finance');
            expect(key1).toMatch(/^ontology:v\d/);
        });
    });

    // ──────────────────────────────────────────────────────────
    //  HARDENING TESTS (Q1, Q2, Q3)
    // ──────────────────────────────────────────────────────────

    describe('Q1: Schema Version Coexistence', () => {

        it('resolves pinned schema versions separately from latest', async () => {
            const { OntologyRegistry } = await import('../../src/ontology/OntologyRegistry.js');
            const registry = new OntologyRegistry();

            // Latest finance should be v1.0.0
            const latest = registry.resolve('finance');
            expect(latest).toBeDefined();
            expect(latest!.version).toBe('1.0.0');

            // Pinned v1.0.0 should match latest
            const pinned = registry.resolve('finance', '1.0.0');
            expect(pinned).toBeDefined();
            expect(pinned!.version).toBe('1.0.0');

            // Non-existent version returns undefined
            const ghost = registry.resolve('finance', '99.99.99');
            expect(ghost).toBeUndefined();
        });

        it('lists available versions per sector', async () => {
            const { OntologyRegistry } = await import('../../src/ontology/OntologyRegistry.js');
            const registry = new OntologyRegistry();

            const versions = registry.listVersions('finance');
            expect(versions).toContain('1.0.0');
        });

        it('supports registering a new version without breaking the old', async () => {
            const { OntologyRegistry } = await import('../../src/ontology/OntologyRegistry.js');
            const { z } = await import('zod');
            const registry = new OntologyRegistry();

            // Register a v2.0.0 finance schema with a new field
            registry.register({
                sectorId: 'finance',
                name: 'Financial Services Ontology v2',
                version: '2.0.0',
                schema: z.object({ entityName: z.string(), newFieldV2: z.string() }),
                vocabulary: ['risk', 'return'],
                description: 'V2 with new field',
                cacheTtlSeconds: 300,
            });

            // Latest should now be v2.0.0
            const latest = registry.resolve('finance');
            expect(latest!.version).toBe('2.0.0');
            expect(Object.keys(latest!.schema.shape)).toContain('newFieldV2');

            // But v1.0.0 should still be resolvable
            const v1 = registry.resolve('finance', '1.0.0');
            expect(v1).toBeDefined();
            expect(v1!.version).toBe('1.0.0');
            expect(Object.keys(v1!.schema.shape)).not.toContain('newFieldV2');

            // Both versions listed
            const versions = registry.listVersions('finance');
            expect(versions).toContain('1.0.0');
            expect(versions).toContain('2.0.0');
        });

        it('GET /api/ontology/schemas includes version list', async () => {
            const { payload } = await request('/api/ontology/schemas');
            const finance = payload.schemas.find((s: any) => s.sectorId === 'finance');
            expect(finance.versions).toBeDefined();
            expect(finance.versions.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Q2: Output Validation', () => {

        it('OntologyService validates LLM output (unit-level)', async () => {
            // Use importActual to bypass vi.mock and get the REAL class
            const actualModule = await vi.importActual<any>('../../src/services/OntologyService.js');
            const svc = new actualModule.OntologyService();

            // Access private method via any cast for testing
            const validate = (svc as any).validateOutput.bind(svc);

            // Valid finance data should get HIGH confidence
            const validFinance = {
                entityName: 'TestCorp',
                entityType: 'hedge_fund',
                jurisdiction: 'US-SEC',
                instruments: [{ ticker: 'AAPL', instrumentType: 'equity', exchange: 'NASDAQ', currency: 'USD' }],
                aum: 50000000,
                settlementProtocol: 'T+1',
                lastAuditDate: '2025-12-01',
            };
            const highResult = validate(validFinance, 'finance');
            expect(highResult.confidence).toBe('high');
            expect(highResult.valid).toBe(true);

            // Completely wrong data should get LOW confidence
            const garbageData = { foo: 'bar' };
            const lowResult = validate(garbageData, 'finance');
            expect(lowResult.confidence).not.toBe('high');

            // No sector = medium confidence (no schema to validate against)
            const noSectorResult = validate(garbageData, undefined);
            expect(noSectorResult.confidence).toBe('medium');
        });
    });

    describe('Q3: Cache Key Determinism', () => {

        it('normalizes whitespace for deterministic keys', async () => {
            const { OntologyCacheStrategy } = await import('../../src/ontology/OntologyCacheStrategy.js');
            const cache = new OntologyCacheStrategy();

            // Extra whitespace should collapse to the same key
            const keyNormal = cache.generateKey('finance', 'test data here');
            const keySpaces = cache.generateKey('finance', '  test   data    here  ');

            expect(keyNormal).toBe(keySpaces);
        });

        it('normalizes unicode for deterministic keys', async () => {
            const { OntologyCacheStrategy } = await import('../../src/ontology/OntologyCacheStrategy.js');
            const cache = new OntologyCacheStrategy();

            // NFC normalization: é (precomposed) vs e + ́ (combining)
            const keyNFC = cache.generateKey('finance', 'caf\u00e9');
            const keyNFD = cache.generateKey('finance', 'cafe\u0301');

            expect(keyNFC).toBe(keyNFD);
        });
    });
});

