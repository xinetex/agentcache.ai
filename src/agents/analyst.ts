
import { db } from '../db/client.js';
import { bannerAnalysis, bancache } from '../db/schema.js';
import { eq, isNull } from 'drizzle-orm';
import { BancacheService } from '../services/bancache.js';
import { LLMFactory } from '../lib/llm/factory.js';

export class AnalystAgent {
    private bancache: BancacheService;

    constructor() {
        this.bancache = new BancacheService();
    }

    /**
     * Find unanalyzed banners and process them
     * @param limit Number of banners to process
     */
    async processBacklog(limit: number = 5): Promise<number> {
        // 1. Find banners in 'bancache' that do NOT have a corresponding 'bannerAnalysis'
        // This requires a LEFT JOIN where the right side is NULL
        const unanalyzed = await db.select()
            .from(bancache)
            .leftJoin(bannerAnalysis, eq(bancache.hash, bannerAnalysis.bannerHash))
            .where(isNull(bannerAnalysis.id))
            .limit(limit);

        console.log(`[Analyst] Found ${unanalyzed.length} unique banners needing analysis.`);
        let processed = 0;

        for (const row of unanalyzed) {
            await this.analyzeBanner(row.bancache.hash, row.bancache.bannerText);
            processed++;
        }

        return processed;
    }

    /**
     * Analyze a single banner using Kimi (Moonshot)
     */
    async analyzeBanner(hash: string, bannerText: string) {
        console.log(`[Analyst] analyzing hash=${hash.slice(0, 8)}...`);
        const start = Date.now();

        try {
            const llm = LLMFactory.createProvider('moonshot'); // Use Kimi

            const prompt = `
You are an expert Cybersecurity Analyst and Vulnerability Researcher.
Analyze the following server banner/header.
Determine the software product, version, operating system, and potential security risks.
Be specific about CVEs if the version implies known vulnerabilities.

BANNER:
${bannerText}

Output strictly valid JSON with this schema:
{
    "classification": "Web Server" | "Database" | "IoT" | "ICS" | "Unknown",
    "product": string,
    "version": string | null,
    "risk_score": number (0.0 to 10.0),
    "vulnerabilities": string[] (list of top 3 most critical CVE IDs likely to affect this version),
    "reasoning": string (concise explanation of the risk score and findings)
}
`;

            const response = await llm.chat([
                { role: 'system', content: 'You are a JSON-only security analyst.' },
                { role: 'user', content: prompt }
            ], {
                model: 'moonshot-v1-8k',
                // jsonMode: true // If supported
            });

            // Parse JSON (robustly finding the JSON block)
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in LLM response");
            }

            const result = JSON.parse(jsonMatch[0]);

            // Save to DB
            await db.insert(bannerAnalysis).values({
                bannerHash: hash,
                agentModel: 'moonshot-v1-8k',
                riskScore: result.risk_score || 0,
                classification: result.classification || 'Unknown',
                vulnerabilities: result.vulnerabilities || [],
                reasoning: result.reasoning || response.content.slice(0, 500),
                compliance: {}, // Placeholder
                analyzedAt: new Date()
            });

            console.log(`[Analyst] Analyzed ${hash.slice(0, 8)} in ${Date.now() - start}ms. Score: ${result.risk_score}`);

        } catch (error) {
            console.error(`[Analyst] Failed to analyze ${hash}:`, error);
            // Optional: Mark as 'failed' to avoid retry loop
        }
    }
}
