import { z } from 'zod';

/**
 * Biotech Sector Ontology
 * Aligned with SNOMED/FHIR vocabulary for clinical and research interop.
 * Covers: sequences, compounds, trials, pathways, assay results.
 */

export const MolecularSequenceSchema = z.object({
    sequenceType: z.enum(['protein', 'dna', 'rna', 'peptide']),
    sequence: z.string().describe("Raw sequence string (amino acids or nucleotides)"),
    length: z.number().optional(),
    organism: z.string().optional().describe("Source organism (e.g., Homo sapiens)"),
    accession: z.string().nullable().describe("UniProt/GenBank accession number"),
});

export const ClinicalTrialSchema = z.object({
    trialId: z.string().describe("NCT identifier or equivalent"),
    phase: z.enum(['preclinical', 'phase_1', 'phase_2', 'phase_3', 'phase_4', 'approved']),
    indication: z.string().describe("Target disease or condition"),
    status: z.enum(['recruiting', 'active', 'completed', 'suspended', 'terminated']),
    enrollmentTarget: z.number().optional(),
    primaryEndpoint: z.string().optional(),
});

export const CompoundSchema = z.object({
    name: z.string(),
    cas: z.string().nullable().describe("CAS Registry Number"),
    molecularWeight: z.number().optional(),
    mechanism: z.string().optional().describe("Mechanism of action"),
    targetProtein: z.string().optional(),
});

export const BiotechOntology = z.object({
    organizationName: z.string(),
    organizationType: z.enum(['pharma', 'biotech', 'cro', 'academic', 'diagnostics', 'medical_device']),
    therapeuticAreas: z.array(z.string()).describe("Focus areas (e.g., oncology, rare disease)"),
    pipeline: z.array(ClinicalTrialSchema).describe("Active clinical pipeline"),
    leadCompounds: z.array(CompoundSchema).optional(),
    sequences: z.array(MolecularSequenceSchema).optional(),
    patents: z.number().nullable().describe("Number of active patents"),
    fdaApprovals: z.number().nullable(),
    collaborations: z.array(z.string()).optional().describe("Partner orgs"),
});

export const BIOTECH_VOCABULARY = {
    canonicalTerms: ['target', 'pathway', 'compound', 'trial', 'efficacy', 'toxicity', 'biomarker'],
    sectorId: 'biotech',
    version: '1.0.0',
} as const;
