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
 * Energy Sector Ontology
 * Aligned with CIM/IEC 61970 vocabulary for grid and energy market interop.
 * Covers: grid telemetry, generation assets, demand forecasts, carbon credits, storage.
 */

export const GenerationAssetSchema = z.object({
    assetId: z.string(),
    assetType: z.enum(['solar', 'wind', 'hydro', 'nuclear', 'natural_gas', 'coal', 'geothermal', 'battery_storage', 'hydrogen']),
    capacity_mw: z.number().describe("Nameplate capacity in megawatts"),
    currentOutput_mw: z.number().optional(),
    location: z.object({
        lat: z.number(),
        lon: z.number(),
        region: z.string(),
    }).optional(),
    status: z.enum(['online', 'offline', 'maintenance', 'ramping', 'curtailed']),
});

export const DemandForecastSchema = z.object({
    region: z.string(),
    timestamp: z.string().describe("ISO datetime for forecast period"),
    predictedLoad_mw: z.number(),
    confidenceInterval: z.number().optional().describe("Confidence % (e.g., 95)"),
    temperature_c: z.number().optional().describe("Ambient temperature driving demand"),
});

export const CarbonCreditSchema = z.object({
    registry: z.enum(['Verra', 'Gold_Standard', 'ACR', 'CAR', 'EU_ETS']),
    creditType: z.enum(['avoidance', 'removal', 'sequestration']),
    vintage: z.string().describe("Year of credit issuance"),
    tonnes_co2e: z.number(),
    pricePerTonne: z.number().optional(),
    verified: z.boolean(),
});

export const EnergyOntology = z.object({
    utilityName: z.string(),
    utilityType: z.enum(['investor_owned', 'municipal', 'cooperative', 'iso_rto', 'independent_producer', 'microgrid']),
    serviceTerritory: z.string().describe("Geographic coverage"),
    generationAssets: z.array(GenerationAssetSchema),
    demandForecasts: z.array(DemandForecastSchema).optional(),
    carbonCredits: z.array(CarbonCreditSchema).optional(),
    renewablePct: z.number().min(0).max(100).describe("Percentage of generation from renewables"),
    gridProtocol: z.enum(['IEC_61970_CIM', 'IEEE_2030', 'OpenADR', 'ICCP']).optional(),
    peakDemand_mw: z.number().nullable(),
    regulatoryBody: z.string().nullable().describe("Primary regulator (e.g., FERC, PUC, Ofgem)"),
});

export const ENERGY_VOCABULARY = {
    canonicalTerms: ['generation', 'load', 'grid', 'carbon', 'renewable', 'storage', 'demand'],
    sectorId: 'energy',
    version: '1.0.0',
} as const;
