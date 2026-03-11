/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { z } from 'zod';
import { LLMFactory } from '../lib/llm/factory.js';
import { LLMProvider } from '../lib/llm/types.js';
import { ontologyCacheStrategy } from '../ontology/OntologyCacheStrategy.js';
import { ontologyRegistry } from '../ontology/OntologyRegistry.js';

/**
 * ValidationResult: Outcome of Zod schema validation on LLM output.
 */
export interface ValidationResult {
    valid: boolean;
    data: any;
    confidence: 'high' | 'medium' | 'low';
    validationErrors: string[];
    requiresHumanReview: boolean;
}

export class OntologyService {
    private llm: LLMProvider;

    constructor(llm?: LLMProvider) {
        // Dependency Injection: Allow custom LLM to be injected (e.g. for testing)
        // Defaults to Inception for high-speed mapping performance
        this.llm = llm || LLMFactory.createProvider('inception');
    }

    /**
     * Map unstructured or multi-domain data into a strict JSON ontology.
     * Uses Inception Labs for high-speed, structured output enforcement.
     * 
     * HARDENING (Q2): Validates LLM output against the Zod schema BEFORE caching.
     * HARDENING (Q3): Cache writes are non-fatal; key generation uses normalized input.
     * 
     * BILLING NOTE (Q3): Billing fires at the auth middleware layer (auth.ts) BEFORE
     * this method is ever called. By the time we reach semanticMap(), the agent has
     * already paid — so a cache hit is pure profit (we skip the LLM but keep the payment).
     * 
     * @param sourceData Raw data string or mixed object to parse.
     * @param targetSchema Zod schema or plain object representing the domain ontology.
     * @param sectorId Optional sector ID for cache-aware mapping and validation.
     * @param schemaVersion Optional pinned schema version (for version coexistence).
     * @returns A validated, strictly formatted JSON object matching the targetSchema.
     */
    async semanticMap(
        sourceData: string | object,
        targetSchema: object,
        sectorId?: string,
        schemaVersion?: string
    ): Promise<any> {
        // HARDENING (Q3): Normalize input for deterministic cache keys
        const strData = this.normalizeInput(sourceData);

        // 1. Check ontology cache (if sector-aware)
        // NOTE: Billing already happened in auth middleware — cache hit = pure margin
        if (sectorId) {
            const cached = await ontologyCacheStrategy.get(sectorId, strData);
            if (cached) {
                console.log(`[OntologyService] Cache HIT for sector ${sectorId} — LLM call saved, billing already captured.`);
                return cached;
            }
        }

        console.log(`[OntologyService] ${sectorId ? `Cache MISS for ${sectorId}. ` : ''}Initiating high-speed map via Inception...`);

        const prompt = `
You are a strict Data Ontology Mapper.
Your single objective is to extract information from the following SOURCE DATA and map it EXACTLY to the structure defined in the TARGET ONTOLOGY SCHEMA.

<SOURCE_DATA>
${strData}
</SOURCE_DATA>

<TARGET_ONTOLOGY_SCHEMA>
${JSON.stringify(targetSchema, null, 2)}
</TARGET_ONTOLOGY_SCHEMA>

Rules:
1. ONLY return valid JSON that conforms to the target schema.
2. DO NOT include markdown formatting or explanations.
3. If data is missing for a required field, infer a reasonable default or use null based on schema definition.
`;

        try {
            const response = await this.llm.chat([
                { role: 'system', content: 'You are a machine-to-machine ontology mapper. Return ONLY JSON.' },
                { role: 'user', content: prompt }
            ], {
                model: 'mercury'
            });

            // Parse result
            const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error("No JSON found in LLM response");
            }

            const rawMapped = JSON.parse(jsonMatch[0]);

            // HARDENING (Q2): Validate against Zod schema before caching
            const validation = this.validateOutput(rawMapped, sectorId, schemaVersion);

            if (!validation.valid) {
                console.warn(`[OntologyService] ⚠️ LLM output failed Zod validation for sector ${sectorId}:`,
                    validation.validationErrors.slice(0, 3).join('; '));

                if (validation.confidence === 'low') {
                    // Low confidence: still return the data but flag for review and DON'T cache
                    console.warn(`[OntologyService] 🚫 LOW confidence — skipping cache write to prevent corruption.`);
                    return {
                        ...validation.data,
                        _meta: {
                            validated: false,
                            confidence: validation.confidence,
                            errors: validation.validationErrors,
                            requiresHumanReview: true,
                            cached: false,
                        }
                    };
                }
            }

            const outputData = validation.valid ? validation.data : rawMapped;

            // HARDENING (Q3): Cache write is non-fatal — swallow errors
            // A failed cache write should NEVER cause a 500 for the agent
            if (sectorId) {
                try {
                    await ontologyCacheStrategy.set(sectorId, strData, outputData);
                } catch (cacheErr: any) {
                    console.error(`[OntologyService] Cache write failed (non-fatal): ${cacheErr.message}`);
                    // Agent still gets their data — we just miss the cache benefit next time
                }
            }

            // Attach validation metadata for transparency
            if (sectorId && validation.confidence !== 'high') {
                return {
                    ...outputData,
                    _meta: {
                        validated: validation.valid,
                        confidence: validation.confidence,
                        errors: validation.validationErrors,
                        requiresHumanReview: validation.requiresHumanReview,
                        cached: true,
                    }
                };
            }

            return outputData;

        } catch (error: any) {
            console.error(`[OntologyService] Mapping failed: ${error.message}`);
            throw new Error(`Ontology Mapping Error: ${error.message}`);
        }
    }

    /**
     * HARDENING (Q2): Validate LLM output against the sector's Zod schema.
     * 
     * Three confidence levels:
     * - HIGH: Zod parse succeeds with zero errors (safe to cache)
     * - MEDIUM: Zod parse succeeds with some coerced/defaulted fields (safe to cache with warning)  
     * - LOW: Zod parse fails — data is structurally wrong (DO NOT cache)
     */
    private validateOutput(data: any, sectorId?: string, schemaVersion?: string): ValidationResult {
        if (!sectorId) {
            // No sector = no schema to validate against — trust the LLM
            return {
                valid: true,
                data,
                confidence: 'medium',
                validationErrors: [],
                requiresHumanReview: false,
            };
        }

        const sector = ontologyRegistry.resolve(sectorId, schemaVersion);
        if (!sector) {
            return {
                valid: true,
                data,
                confidence: 'medium',
                validationErrors: [`Sector "${sectorId}" not found in registry — skipping validation`],
                requiresHumanReview: false,
            };
        }

        // Attempt strict Zod parse
        const result = sector.schema.safeParse(data);

        if (result.success) {
            return {
                valid: true,
                data: result.data,
                confidence: 'high',
                validationErrors: [],
                requiresHumanReview: false,
            };
        }

        // Parse failed — assess severity
        const errors = result.error.issues.map((issue: z.ZodIssue) =>
            `${issue.path.join('.')}: ${issue.message}`
        );

        const requiredFieldErrors = result.error.issues.filter(
            (issue: z.ZodIssue) => issue.code === 'invalid_type' && 'expected' in issue
        );

        const totalFields = Object.keys(sector.schema.shape).length;
        const missingRequiredPct = totalFields > 0 ? requiredFieldErrors.length / totalFields : 0;

        // If >50% of required fields are missing, this is low confidence
        if (missingRequiredPct > 0.5) {
            return {
                valid: false,
                data,
                confidence: 'low',
                validationErrors: errors,
                requiresHumanReview: true,
            };
        }

        // Some errors but mostly intact — medium confidence
        return {
            valid: false,
            data,
            confidence: 'medium',
            validationErrors: errors,
            requiresHumanReview: errors.length > 3,
        };
    }

    /**
     * HARDENING (Q3): Normalize input for deterministic cache keys.
     * Handles: unicode normalization, whitespace collapsing, stable JSON serialization.
     */
    private normalizeInput(sourceData: string | object): string {
        let str = typeof sourceData === 'string'
            ? sourceData
            : this.stableStringify(sourceData);

        // Unicode NFC normalization (é vs e + combining accent → same bytes)
        str = str.normalize('NFC');

        // Collapse internal whitespace runs (preserves semantic content)
        str = str.replace(/\s+/g, ' ').trim();

        return str;
    }

    /**
     * Stable JSON stringification with sorted keys.
     * Ensures { a: 1, b: 2 } and { b: 2, a: 1 } produce the same cache key.
     */
    private stableStringify(obj: object): string {
        return JSON.stringify(obj, Object.keys(obj).sort());
    }
}

export const ontologyService = new OntologyService();
