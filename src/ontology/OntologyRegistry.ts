import { z } from 'zod';

// Sector schemas
import { FinanceOntology, FINANCE_VOCABULARY } from './schemas/finance.js';
import { BiotechOntology, BIOTECH_VOCABULARY } from './schemas/biotech.js';
import { LegalOntology, LEGAL_VOCABULARY } from './schemas/legal.js';
import { RoboticsOntology, ROBOTICS_VOCABULARY } from './schemas/robotics.js';
import { HealthcareOntology, HEALTHCARE_VOCABULARY } from './schemas/healthcare.js';
import { EnergyOntology, ENERGY_VOCABULARY } from './schemas/energy.js';

/**
 * SectorOntology: A registered ontology entry in the registry.
 */
export interface SectorOntology {
    sectorId: string;
    name: string;
    version: string;
    schema: z.ZodObject<any>;
    vocabulary: readonly string[];
    description: string;
    cacheTtlSeconds: number; // Sector-specific cache TTL
}

/**
 * OntologyRegistry: Centralized, O(1) registry mapping sector identifiers to
 * strongly-typed Zod schemas. Designed for agent discovery and programmatic access.
 * 
 * HARDENING: Now supports multi-version schema coexistence.
 * - `resolve('finance')` returns the latest version
 * - `resolve('finance', '1.0.0')` returns a pinned version
 * - Old cached results keyed on v1.0.0 won't contaminate v1.1.0 consumers
 * 
 * Singleton — accessible globally via `ontologyRegistry`.
 */
export class OntologyRegistry {
    // Primary: sectorId → latest SectorOntology
    private sectors: Map<string, SectorOntology> = new Map();
    // Versioned: "sectorId@version" → SectorOntology (for pinned lookups)
    private versionedSectors: Map<string, SectorOntology> = new Map();
    // Term index: term → [sectorIds]
    private termIndex: Map<string, string[]> = new Map();

    constructor() {
        this.registerBuiltins();
    }

    /**
     * Register a sector ontology. Always sets as "latest" and also stores by version.
     * If a sector already exists at a different version, the new version becomes latest
     * while the old version remains accessible via pinned lookup.
     */
    register(entry: SectorOntology): void {
        const versionedKey = `${entry.sectorId}@${entry.version}`;

        // Store as latest
        this.sectors.set(entry.sectorId, entry);
        // Store by version (never overwritten — immutable history)
        this.versionedSectors.set(versionedKey, entry);

        // Index vocabulary terms for cross-sector lookup
        for (const term of entry.vocabulary) {
            const existing = this.termIndex.get(term) || [];
            if (!existing.includes(entry.sectorId)) {
                existing.push(entry.sectorId);
            }
            this.termIndex.set(term, existing);
        }

        console.log(`[OntologyRegistry] Registered: ${entry.sectorId} v${entry.version} (${entry.vocabulary.length} terms)`);
    }

    /**
     * Resolve a sector schema by ID.
     * - Without version: returns the latest (O(1) Map lookup)
     * - With version: returns the exact pinned version (O(1) Map lookup)
     * 
     * This ensures agents on v1.0 get v1.0 schemas while newer agents get v1.1,
     * and cache keys naturally namespace by version (no cross-contamination).
     */
    resolve(sectorId: string, version?: string): SectorOntology | undefined {
        if (version) {
            return this.versionedSectors.get(`${sectorId}@${version}`);
        }
        return this.sectors.get(sectorId);
    }

    /**
     * List all available versions for a sector.
     */
    listVersions(sectorId: string): string[] {
        const versions: string[] = [];
        const prefix = `${sectorId}@`;
        for (const key of this.versionedSectors.keys()) {
            if (key.startsWith(prefix)) {
                versions.push(key.replace(prefix, ''));
            }
        }
        return versions;
    }

    /**
     * List all registered sectors (for agent discovery / GET /api/ontology/schemas).
     */
    listAll(): Array<{
        sectorId: string;
        name: string;
        version: string;
        versions: string[];
        description: string;
        fields: string[];
        cacheTtlSeconds: number;
    }> {
        return Array.from(this.sectors.values()).map(s => ({
            sectorId: s.sectorId,
            name: s.name,
            version: s.version,
            versions: this.listVersions(s.sectorId),
            description: s.description,
            fields: Object.keys(s.schema.shape),
            cacheTtlSeconds: s.cacheTtlSeconds,
        }));
    }

    /**
     * Find all sectors that reference a given canonical term.
     */
    findByTerm(term: string): string[] {
        return this.termIndex.get(term.toLowerCase()) || [];
    }

    /**
     * Get the full vocabulary index (term → sectors).
     */
    getTermIndex(): Map<string, string[]> {
        return this.termIndex;
    }

    /**
     * Get total sector count (latest versions only).
     */
    get size(): number {
        return this.sectors.size;
    }

    /**
     * Register all built-in sector ontologies.
     */
    private registerBuiltins(): void {
        this.register({
            sectorId: 'finance',
            name: 'Financial Services Ontology',
            version: FINANCE_VOCABULARY.version,
            schema: FinanceOntology,
            vocabulary: FINANCE_VOCABULARY.canonicalTerms,
            description: 'Instruments, risk metrics, regulatory entities, and settlements. Aligned with FIX/FpML.',
            cacheTtlSeconds: 300, // 5 min — markets move fast
        });

        this.register({
            sectorId: 'biotech',
            name: 'Biotechnology & Pharma Ontology',
            version: BIOTECH_VOCABULARY.version,
            schema: BiotechOntology,
            vocabulary: BIOTECH_VOCABULARY.canonicalTerms,
            description: 'Sequences, clinical trials, compounds, and pathways. Aligned with SNOMED/FHIR.',
            cacheTtlSeconds: 604800, // 7 days — trial data moves slowly
        });

        this.register({
            sectorId: 'legal',
            name: 'Legal & Compliance Ontology',
            version: LEGAL_VOCABULARY.version,
            schema: LegalOntology,
            vocabulary: LEGAL_VOCABULARY.canonicalTerms,
            description: 'Clauses, obligations, parties, and jurisdictions. Aligned with LKIF/Akoma Ntoso.',
            cacheTtlSeconds: 2592000, // 30 days — legal docs are static
        });

        this.register({
            sectorId: 'robotics',
            name: 'Robotics & Autonomous Systems Ontology',
            version: ROBOTICS_VOCABULARY.version,
            schema: RoboticsOntology,
            vocabulary: ROBOTICS_VOCABULARY.canonicalTerms,
            description: 'Sensors, kinematics, task plans, and environment maps. Aligned with ROS/IEEE.',
            cacheTtlSeconds: 60, // 1 min — real-time telemetry
        });

        this.register({
            sectorId: 'healthcare',
            name: 'Healthcare & Clinical Ontology',
            version: HEALTHCARE_VOCABULARY.version,
            schema: HealthcareOntology,
            vocabulary: HEALTHCARE_VOCABULARY.canonicalTerms,
            description: 'Diagnoses, medications, observations, and FHIR resources. Aligned with HL7 FHIR R4.',
            cacheTtlSeconds: 86400, // 24 hours — clinical data
        });

        this.register({
            sectorId: 'energy',
            name: 'Energy & Grid Ontology',
            version: ENERGY_VOCABULARY.version,
            schema: EnergyOntology,
            vocabulary: ENERGY_VOCABULARY.canonicalTerms,
            description: 'Generation assets, demand forecasts, carbon credits, and grid protocols. Aligned with CIM/IEC 61970.',
            cacheTtlSeconds: 900, // 15 min — grid telemetry
        });
    }
}

export const ontologyRegistry = new OntologyRegistry();
