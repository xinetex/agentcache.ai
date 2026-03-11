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
 * Healthcare Sector Ontology
 * Aligned with HL7 FHIR R4 vocabulary for clinical data interop.
 * Covers: patients, encounters, diagnoses, medications, observations.
 */

export const DiagnosisSchema = z.object({
    code: z.string().describe("ICD-10 or SNOMED-CT code"),
    display: z.string().describe("Human-readable diagnosis name"),
    system: z.enum(['ICD-10', 'SNOMED-CT', 'DSM-5', 'LOINC']),
    severity: z.enum(['mild', 'moderate', 'severe', 'critical']).optional(),
    onsetDate: z.string().nullable(),
});

export const MedicationSchema = z.object({
    name: z.string(),
    rxNormCode: z.string().nullable(),
    dosage: z.string().optional().describe("e.g., 500mg twice daily"),
    route: z.enum(['oral', 'iv', 'im', 'subcutaneous', 'topical', 'inhaled']).optional(),
    status: z.enum(['active', 'discontinued', 'completed', 'on_hold']),
});

export const ObservationSchema = z.object({
    loincCode: z.string().nullable().describe("LOINC code for the observation"),
    display: z.string(),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional(),
    timestamp: z.string().describe("ISO datetime of observation"),
    abnormal: z.boolean().optional(),
});

export const HealthcareOntology = z.object({
    facilityName: z.string(),
    facilityType: z.enum(['hospital', 'clinic', 'lab', 'pharmacy', 'telehealth', 'research_center', 'long_term_care']),
    ehrSystem: z.string().nullable().describe("EHR vendor (e.g., Epic, Cerner, Meditech)"),
    specialties: z.array(z.string()).describe("Clinical specialties offered"),
    diagnoses: z.array(DiagnosisSchema).optional(),
    medications: z.array(MedicationSchema).optional(),
    observations: z.array(ObservationSchema).optional(),
    complianceFrameworks: z.array(z.string()).describe("HIPAA, HITECH, GDPR-Health"),
    interopCapabilities: z.array(z.enum(['FHIR_R4', 'HL7_V2', 'DICOM', 'C-CDA', 'SMART_on_FHIR'])),
    bedCount: z.number().nullable(),
});

export const HEALTHCARE_VOCABULARY = {
    canonicalTerms: ['diagnosis', 'medication', 'observation', 'encounter', 'patient', 'compliance', 'risk'],
    sectorId: 'healthcare',
    version: '1.0.0',
} as const;
