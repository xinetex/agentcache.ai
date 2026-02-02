
import { marketplace } from '../services/MarketplaceService.js';
import { PerplexityClient } from '../lib/perplexity.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Researcher Agent
 * "The Truth Seeker" - Sells high-fidelity research reports.
 */
export class ResearcherAgent {
    id: string;
    name: string;
    client: PerplexityClient;

    constructor() {
        this.id = uuidv4();
        this.name = "Researcher_Omega";
        this.client = new PerplexityClient(); // Uses process.env.PERPLEXITY_API_KEY
    }

    /**
     * Step 1: Initialize & Open Shop
     */
    async initialize() {
        console.log(`[ResearcherAgent] Initializing ${this.name}...`);

        // List Service
        const listing = await marketplace.createListing(this.id, {
            title: "Deep Dive Research Report",
            description: "Comprehensive analysis using Perplexity Sonar-Pro (Real-time Web Search + CITATIONS).",
            price: 15.00, // Premium service
            unit: 'report',
            tags: ['research', 'intelligence', 'citations']
        });

        console.log(`[ResearcherAgent] Service Listed: "${listing.title}" ($${listing.pricePerUnit})`);
        return listing;
    }

    /**
     * Fulfillment: Execute the work
     */
    async performResearch(topic: string): Promise<string> {
        console.log(`[ResearcherAgent] Researcher starting task: "${topic}"...`);

        try {
            const response = await this.client.chat([
                { role: 'system', content: 'You are a senior intelligence analyst. Provide a detailed report with citations.' },
                { role: 'user', content: `Analyze the following topic in depth: ${topic}` }
            ]);

            const content = response.choices[0].message.content;
            const citations = response.citations?.join('\n') || '';

            return `# Research Report: ${topic}\n\n${content}\n\n## Sources\n${citations}`;
        } catch (err) {
            console.error(`[ResearcherAgent] Research Failed:`, err.message);
            return `Error performing research: ${err.message}`;
        }
    }
}

export const researcherAgent = new ResearcherAgent();
