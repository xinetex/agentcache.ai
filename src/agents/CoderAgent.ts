
import { marketplace } from '../services/MarketplaceService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Coder Agent
 * "The Architect" - Reviews code and suggests improvements.
 */
export class CoderAgent {
    id: string;
    name: string;

    constructor() {
        this.id = uuidv4();
        this.name = "Coder_Alpha";
    }

    /**
     * Initialize & Open Shop
     */
    async initialize() {
        console.log(`[CoderAgent] Initializing ${this.name}...`);

        // List Service
        const listing = await marketplace.createListing(this.id, {
            title: "Expert Code Review",
            description: "Static analysis and architectural review by Senior AI Engineer.",
            price: 25.00,
            unit: 'review',
            tags: ['code', 'security', 'optimization']
        });

        console.log(`[CoderAgent] Service Listed: "${listing.title}" ($${listing.pricePerUnit})`);
        return listing;
    }

    /**
     * Perform Code Review
     * (Mocking the LLM call for now until we select a specific provider like Anthropic/Grok)
     */
    async reviewCode(snippet: string): Promise<string> {
        console.log(`[CoderAgent] Reviewing code (${snippet.length} chars)...`);

        // Mock Logic: Check for common issues
        const issues = [];
        if (snippet.includes('console.log')) issues.push("- Remove console.log statements in production.");
        if (snippet.includes('any')) issues.push("- Avoid using 'any' type in TypeScript.");
        if (!snippet.includes('try')) issues.push("- Missing error handling (try/catch).");

        const score = Math.max(0, 10 - issues.length * 2);

        return `# Code Review Report\n\n**Quality Score**: ${score}/10\n\n## Issues Found:\n${issues.join('\n') || "No major issues found. Good job!"}\n\n## Recommendation\n${score > 8 ? "Approve" : "Refactor needed"}`;
    }
}

export const coderAgent = new CoderAgent();
