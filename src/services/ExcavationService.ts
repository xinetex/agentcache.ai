import { z } from 'zod';
import { firecrawlService } from './FirecrawlService.js';
import { ontologyService } from './OntologyService.js';

// Define the Target Ontology (What we want to excavate from the sludge)
// This is an example B2B "Company Profile" lead generation schema.
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
     * This orchestrates Phase 1 (Ingestion) and Phase 2 (Excavation via Inception Labs).
     */
    async excavateUrl(url: string, targetSchema: z.ZodObject<any> | z.ZodRecord = CompanyProfileSchema): Promise<any> {
        console.log(`[Excavator] Commencing drill sequence on: ${url}`);

        // 1. Ingestion Phase
        let rawMarkdown = "";
        try {
            // Using Firecrawl to get clean markdown from the target URL
            rawMarkdown = await firecrawlService.scrapeUrl(url);
            console.log(`[Excavator] Ingestion complete. Extracted ${rawMarkdown.length} bytes of raw markdown.`);
        } catch (error: any) {
            console.error(`[Excavator] Drill failed at ${url}: ${error.message}`);
            throw new Error(`Ingestion failed: ${error.message}`);
        }

        // 2. Chunker/Optimization
        // If the chunk is massive (e.g., > 40k chars), we might want to slice it or 
        // run parallel map operations. For MVP, we send the first 30,000 characters 
        // assuming key company info is near the top (Home/About).
        const maxTokens = 30000;
        const sludgeChunk = rawMarkdown.length > maxTokens
            ? rawMarkdown.substring(0, maxTokens) + "\n...[TRUNCATED]"
            : rawMarkdown;

        // 3. Excavation Phase
        console.log(`[Excavator] Sifting sludge through Inception Labs Ontology Map...`);
        const startTime = Date.now();

        try {
            // Using our high-speed OntologyService map
            const excavatedData = await ontologyService.semanticMap(sludgeChunk, targetSchema);
            const latency = Date.now() - startTime;

            console.log(`[Excavator] Target Acquired in ${latency}ms.`);

            return {
                sourceUrl: url,
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
