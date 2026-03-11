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

/**
 * Legal Sector Ontology
 * Aligned with LKIF/Akoma Ntoso vocabulary for regulatory interop.
 * Covers: clauses, obligations, parties, jurisdictions, compliance.
 */

export const PartySchema = z.object({
    name: z.string(),
    role: z.enum(['plaintiff', 'defendant', 'licensor', 'licensee', 'vendor', 'client', 'guarantor', 'regulator']),
    jurisdiction: z.string().optional(),
    entityType: z.enum(['individual', 'corporation', 'llc', 'partnership', 'government', 'trust']).optional(),
});

export const ClauseSchema = z.object({
    clauseId: z.string(),
    title: z.string(),
    category: z.enum(['liability', 'indemnification', 'termination', 'confidentiality', 'ip_rights', 'force_majeure', 'governing_law', 'arbitration', 'data_protection', 'ai_specific']),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    summary: z.string().describe("Plain-language summary of the clause"),
    obligations: z.array(z.string()).describe("Specific obligations imposed"),
});

export const LegalOntology = z.object({
    documentTitle: z.string(),
    documentType: z.enum(['contract', 'regulation', 'opinion', 'filing', 'patent', 'license', 'policy', 'amendment']),
    parties: z.array(PartySchema),
    effectiveDate: z.string().nullable().describe("ISO date"),
    expirationDate: z.string().nullable(),
    governingLaw: z.string().describe("Jurisdiction governing the document"),
    clauses: z.array(ClauseSchema),
    complianceFrameworks: z.array(z.string()).optional().describe("Applicable frameworks (e.g., GDPR, SOC2, HIPAA, EU AI Act)"),
    riskScore: z.number().min(0).max(100).describe("Aggregate risk score 0-100"),
    requiresHumanReview: z.boolean().describe("True if flagged for attorney review"),
});

export const LEGAL_VOCABULARY = {
    canonicalTerms: ['obligation', 'liability', 'compliance', 'risk', 'jurisdiction', 'termination', 'indemnity'],
    sectorId: 'legal',
    version: '1.0.0',
} as const;
