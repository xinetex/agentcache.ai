import { ontologyRegistry } from './OntologyRegistry.js';

/**
 * CrossSectorMapping: A synonym link between terms across sectors.
 */
interface CrossSectorMapping {
    canonicalTerm: string;
    sectors: Map<string, string[]>; // sectorId → sector-specific equivalent terms
}

/**
 * OntologyBridge: Enables cross-sector semantic federation.
 * 
 * An agent asking about "risk" in finance should also discover related
 * concepts in legal ("liability") and robotics ("hazard"). This bridge
 * maintains a bidirectional synonym map and supports federated queries.
 */
export class OntologyBridge {
    private synonymMap: Map<string, CrossSectorMapping> = new Map();

    constructor() {
        this.buildDefaultSynonyms();
    }

    /**
     * Bridge a term from one sector to another.
     * Returns the equivalent terms in the target sector, or empty array if no mapping.
     */
    bridge(term: string, fromSector: string, toSector: string): string[] {
        const normalizedTerm = term.toLowerCase();

        // Direct match in synonym map
        const mapping = this.synonymMap.get(normalizedTerm);
        if (mapping) {
            return mapping.sectors.get(toSector) || [];
        }

        // Reverse lookup: check if the term is a sector-specific synonym
        for (const [canonical, crossMapping] of this.synonymMap) {
            const fromTerms = crossMapping.sectors.get(fromSector) || [];
            if (fromTerms.includes(normalizedTerm)) {
                return crossMapping.sectors.get(toSector) || [];
            }
        }

        return [];
    }

    /**
     * Federated query: given a term, find ALL sectors and their equivalent concepts.
     */
    federatedQuery(term: string): Array<{
        sectorId: string;
        sectorName: string;
        equivalentTerms: string[];
        schemaFields: string[];
    }> {
        const normalizedTerm = term.toLowerCase();
        const results: Array<{
            sectorId: string;
            sectorName: string;
            equivalentTerms: string[];
            schemaFields: string[];
        }> = [];

        // Check both canonical terms and sector-specific synonyms
        const relevantMappings: CrossSectorMapping[] = [];

        // Direct canonical match
        const directMapping = this.synonymMap.get(normalizedTerm);
        if (directMapping) {
            relevantMappings.push(directMapping);
        }

        // Reverse lookup through all mappings
        for (const [_, mapping] of this.synonymMap) {
            for (const [sectorId, terms] of mapping.sectors) {
                if (terms.includes(normalizedTerm) && !relevantMappings.includes(mapping)) {
                    relevantMappings.push(mapping);
                }
            }
        }

        // Also check the registry's term index for direct vocabulary matches
        const registrySectors = ontologyRegistry.findByTerm(normalizedTerm);

        // Collect all relevant sector IDs
        const sectorIds = new Set<string>(registrySectors);
        for (const mapping of relevantMappings) {
            for (const sectorId of mapping.sectors.keys()) {
                sectorIds.add(sectorId);
            }
        }

        // Build results
        for (const sectorId of sectorIds) {
            const sector = ontologyRegistry.resolve(sectorId);
            if (!sector) continue;

            const equivalentTerms = new Set<string>();

            // Collect all equivalent terms from relevant mappings
            for (const mapping of relevantMappings) {
                const sectorTerms = mapping.sectors.get(sectorId) || [];
                sectorTerms.forEach(t => equivalentTerms.add(t));
            }

            // Add the original term if this sector has it in vocabulary
            if (registrySectors.includes(sectorId)) {
                equivalentTerms.add(normalizedTerm);
            }

            results.push({
                sectorId,
                sectorName: sector.name,
                equivalentTerms: Array.from(equivalentTerms),
                schemaFields: Object.keys(sector.schema.shape),
            });
        }

        return results;
    }

    /**
     * Register a custom cross-sector synonym mapping.
     */
    addSynonym(canonicalTerm: string, sectorTerms: Record<string, string[]>): void {
        const mapping: CrossSectorMapping = {
            canonicalTerm: canonicalTerm.toLowerCase(),
            sectors: new Map(Object.entries(sectorTerms)),
        };
        this.synonymMap.set(canonicalTerm.toLowerCase(), mapping);
    }

    /**
     * Build the default cross-sector synonym map.
     * This encodes domain expert knowledge about how concepts translate between industries.
     */
    private buildDefaultSynonyms(): void {
        // Risk is the universal concept
        this.addSynonym('risk', {
            finance: ['risk', 'exposure', 'volatility', 'var'],
            legal: ['liability', 'risk', 'obligation'],
            biotech: ['toxicity', 'adverse_event', 'safety_signal'],
            robotics: ['hazard', 'obstacle', 'collision_risk'],
            healthcare: ['risk', 'adverse_event', 'complication'],
            energy: ['outage_risk', 'supply_risk', 'grid_instability'],
        });

        // Compliance spans every sector
        this.addSynonym('compliance', {
            finance: ['compliance', 'regulatory', 'audit'],
            legal: ['compliance', 'jurisdiction', 'governing_law'],
            biotech: ['regulatory_approval', 'fda', 'ema'],
            robotics: ['safety_rating', 'iso_compliance', 'certification'],
            healthcare: ['hipaa', 'hitech', 'compliance', 'accreditation'],
            energy: ['regulatory', 'ferc', 'puc', 'grid_code'],
        });

        // Asset / Entity
        this.addSynonym('asset', {
            finance: ['instrument', 'position', 'holding'],
            legal: ['property', 'intellectual_property', 'asset'],
            biotech: ['compound', 'molecule', 'patent'],
            robotics: ['platform', 'equipment', 'sensor'],
            healthcare: ['device', 'equipment', 'facility'],
            energy: ['generation_asset', 'storage', 'infrastructure'],
        });

        // Performance / Efficiency
        this.addSynonym('performance', {
            finance: ['return', 'sharpe_ratio', 'alpha'],
            legal: ['obligation_fulfillment', 'performance'],
            biotech: ['efficacy', 'potency', 'bioavailability'],
            robotics: ['throughput', 'cycle_time', 'autonomy'],
            healthcare: ['outcome', 'quality_measure', 'readmission_rate'],
            energy: ['capacity_factor', 'efficiency', 'yield'],
        });

        // Time / Duration
        this.addSynonym('timeline', {
            finance: ['settlement', 'maturity', 'expiration'],
            legal: ['effective_date', 'term', 'statute_of_limitations'],
            biotech: ['trial_duration', 'half_life', 'time_to_market'],
            robotics: ['mission_duration', 'cycle_time', 'battery_life'],
            healthcare: ['length_of_stay', 'recovery_time', 'follow_up'],
            energy: ['contract_term', 'peak_hours', 'ramp_time'],
        });
    }
}

export const ontologyBridge = new OntologyBridge();
