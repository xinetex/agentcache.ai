/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { createHash } from 'crypto';
import { db } from '../db/client.js';
import { bancache, bannerAnalysis } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { LLMFactory } from '../lib/llm/factory.js';

export interface BannerIntelligence {
    riskScore: number;
    classification: string;
    vulnerabilities: string[];
    compliance: {
        pci?: boolean;
        hipaa?: boolean;
        gdpr?: boolean;
    };
    reasoning: string;
}

export class BancacheService {
    private model = 'kimi-k2.5'; // The intended reasoning model

    /**
     * Analyze a banner, using cache if available
     */
    async analyzeBanner(bannerText: string): Promise<BannerIntelligence> {
        const hash = createHash('sha256').update(bannerText).digest('hex');

        // 1. Check if we already have an analysis for this hash
        const existing = await db.select()
            .from(bannerAnalysis)
            .where(eq(bannerAnalysis.bannerHash, hash))
            .limit(1);

        if (existing.length > 0) {
            const analysis = existing[0];
            return {
                riskScore: analysis.riskScore || 0,
                classification: analysis.classification || 'Unknown',
                vulnerabilities: (analysis.vulnerabilities as string[]) || [],
                compliance: (analysis.compliance as any) || {},
                reasoning: analysis.reasoning || ''
            };
        }

        // 2. No analysis found - Perform Dedup insertion into bancache
        await db.insert(bancache)
            .values({
                hash: hash,
                bannerText: bannerText,
                seenCount: 1
            })
            .onConflictDoUpdate({
                target: bancache.hash,
                set: { 
                    seenCount: sql`${bancache.seenCount} + 1`,
                    lastSeenAt: sql`now()`
                }
            });

        // 3. Request LLM Analysis
        const intelligence = await this.requestAIAssessment(bannerText);

        // 4. Store Analysis
        await db.insert(bannerAnalysis)
            .values({
                bannerHash: hash,
                agentModel: this.model,
                riskScore: intelligence.riskScore,
                classification: intelligence.classification,
                vulnerabilities: intelligence.vulnerabilities,
                compliance: intelligence.compliance,
                reasoning: intelligence.reasoning
            });

        return intelligence;
    }

    private async requestAIAssessment(banner: string): Promise<BannerIntelligence> {
        let llm;
        try {
            llm = LLMFactory.createProvider('moonshot');
        } catch (e) {
            console.warn("[Bancache] LLM Provider 'moonshot' unavailable. Using fallback risk assessment.");
            return this.getFallbackAssessment(banner);
        }
        
        const systemPrompt = `You are a cybersecurity expert at AgentCache.ai. 
Analyze the following server banner or HTTP response header. 
Classify the service, estimate a risk score (0-10), identify potential CVEs or vulnerabilities, 
and check for generic compliance implications (PCI, HIPAA, GDPR).
Return your response in strict JSON format:
{
  "riskScore": number,
  "classification": "string",
  "vulnerabilities": ["string"],
  "compliance": { "pci": boolean, "hipaa": boolean, "gdpr": boolean },
  "reasoning": "string"
}`;

        try {
            const response = await llm.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Banner: "${banner}"` }
            ], { model: this.model });

            // Primitive JSON extraction if LLM adds markdown
            const jsonText = response.content.includes('```json') 
                ? response.content.split('```json')[1].split('```')[0]
                : response.content;
            
            return JSON.parse(jsonText.trim());
        } catch (e: any) {
            console.warn(`[Bancache] AI Assessment failed: ${e.message}. Using fallback.`);
            return this.getFallbackAssessment(banner);
        }
    }

    private getFallbackAssessment(banner: string): BannerIntelligence {
        // Simple heuristic for fallback
        const isVulnerable = banner.includes('Old') || banner.includes('7.4');
        return {
            riskScore: isVulnerable ? 8 : 2,
            classification: 'Legacy Infrastructure (Heuristic)',
            vulnerabilities: isVulnerable ? ['CVE-2016-XXXX'] : [],
            compliance: {},
            reasoning: 'Provider unavailable. Using heuristic fallback.'
        };
    }
}

export const bancacheService = new BancacheService();
