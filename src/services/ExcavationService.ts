import { z } from 'zod';
import { firecrawlService } from './FirecrawlService.js';
import { ontologyService } from './OntologyService.js';
import { ontologyRegistry } from '../ontology/OntologyRegistry.js';

// Legacy: Default B2B schema (preserved for backward compatibility)
export const CompanyProfileSchema = z.object({
    companyName: z.string().describe("The official name of the company."),
    missionStatement: z.string().describe("A 1-2 sentence summary of what the company does."),
    industry: z.string().describe("The primary industry (e.g., B2B SaaS, Healthcare, FinTech)."),
    estimatedEmployeeCount: z.union([z.string(), z.number()]).nullable().describe("Number of employees if mentioned."),
    keyExecutives: z.array(z.object({
        name: z.string(),
        title: z.string()
    })).describe("List of founders, CEO, or key leadership mentioned on the page."),
    targetAudience: z.string().describe("Who does this company sell to?"),
    pricingModel: z.string().nullable().describe("Do they mention 'Free Tier', 'Enterprise', or specific pricing?"),
    contactEmail: z.string().email().nullable().describe("Any support or sales email found on the page."),
    isActivelyHiring: z.boolean().describe("True if they mention 'Careers', 'We are hiring', or open roles.")
});

export class ExcavationService {

    /**
     * Excavate a specific URL for a given target ontology.
     * Now supports sector-specific schemas via the OntologyRegistry.
     * 
     * @param url Target URL to scrape and map
     * @param targetSchema Legacy: explicit Zod schema override
     * @param sectorId New: resolve schema from registry (takes precedence if schema also provided)
     */
    async excavateUrl(
        url: string,
        targetSchema?: z.ZodObject<any> | z.ZodRecord,
        sectorId?: string
    ): Promise<any> {
        console.log(`[Excavator] Commencing drill sequence on: ${url}`);

        // Resolve schema: registry takes priority, then explicit, then default
        let resolvedSchema: z.ZodObject<any> | z.ZodRecord = CompanyProfileSchema;
        let resolvedSectorId: string | undefined = sectorId;

        if (sectorId) {
            const sector = ontologyRegistry.resolve(sectorId);
            if (sector) {
                resolvedSchema = sector.schema;
                console.log(`[Excavator] Using registry schema for sector: ${sectorId}`);
            } else {
                console.warn(`[Excavator] Unknown sector "${sectorId}", falling back to explicit schema or CompanyProfile.`);
                resolvedSectorId = undefined;
                if (targetSchema) resolvedSchema = targetSchema;
            }
        } else if (targetSchema) {
            resolvedSchema = targetSchema;
        }

        // 1. Ingestion Phase
        let rawMarkdown = "";
        try {
            rawMarkdown = await firecrawlService.scrapeUrl(url);
            console.log(`[Excavator] Ingestion complete. Extracted ${rawMarkdown.length} bytes of raw markdown.`);
        } catch (error: any) {
            console.error(`[Excavator] Drill failed at ${url}: ${error.message}`);
            throw new Error(`Ingestion failed: ${error.message}`);
        }

        // 2. Chunker/Optimization
        const maxTokens = 30000;
        const sludgeChunk = rawMarkdown.length > maxTokens
            ? rawMarkdown.substring(0, maxTokens) + "\n...[TRUNCATED]"
            : rawMarkdown;

        // 3. Excavation Phase (now with sector-aware caching)
        console.log(`[Excavator] Sifting sludge through Inception Labs Ontology Map...`);
        const startTime = Date.now();

        try {
            const excavatedData = await ontologyService.semanticMap(sludgeChunk, resolvedSchema, resolvedSectorId);
            const latency = Date.now() - startTime;

            console.log(`[Excavator] Target Acquired in ${latency}ms.`);

            return {
                sourceUrl: url,
                sectorId: resolvedSectorId || 'generic',
                excavatedAt: new Date().toISOString(),
                latencyMs: latency,
                data: excavatedData
            };
        } catch (error: any) {
            console.error(`[Excavator] Sieve failure on ${url}: ${error.message}`);
            throw new Error(`Ontology Mapping failed: ${error.message}`);
        }
    }
}

export const excavationService = new ExcavationService();
