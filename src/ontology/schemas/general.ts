/**
 * General software and workspace ontology for workflows that do not belong to
 * a regulated or domain-specific sector.
 */
import { z } from 'zod';

export const GeneralOntology = z.object({
  kind: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const GENERAL_VOCABULARY = {
  sectorId: 'general',
  version: '1.0.0',
  canonicalTerms: [
    'general software', 'enterprise software', 'business application',
    'workspace workflow', 'generic software workflow',
  ],
} as const;
