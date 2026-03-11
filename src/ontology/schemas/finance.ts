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
 * Finance Sector Ontology
 * Aligned with FIX/FpML vocabulary for institutional interop.
 * Covers: instruments, positions, risk metrics, regulatory entities, settlements.
 */

export const FinancialInstrumentSchema = z.object({
    ticker: z.string().describe("Unique instrument identifier (e.g., AAPL, BTC-USD)"),
    instrumentType: z.enum(['equity', 'bond', 'derivative', 'crypto', 'commodity', 'fx']),
    exchange: z.string().nullable().describe("Primary exchange or venue"),
    currency: z.string().default('USD'),
});

export const RiskMetricSchema = z.object({
    var_95: z.number().describe("Value at Risk at 95% confidence interval"),
    var_99: z.number().optional().describe("Value at Risk at 99% confidence"),
    sharpeRatio: z.number().optional(),
    maxDrawdown: z.number().optional(),
    beta: z.number().optional(),
});

export const FinanceOntology = z.object({
    entityName: z.string().describe("Legal entity or fund name"),
    entityType: z.enum(['hedge_fund', 'bank', 'broker_dealer', 'exchange', 'fintech', 'insurance', 'regulator']),
    jurisdiction: z.string().describe("Primary regulatory jurisdiction (e.g., US-SEC, UK-FCA, EU-ESMA)"),
    instruments: z.array(FinancialInstrumentSchema).describe("Instruments traded or referenced"),
    riskProfile: RiskMetricSchema.optional(),
    aum: z.number().nullable().describe("Assets under management in USD"),
    regulatoryIds: z.record(z.string(), z.string()).optional().describe("Map of regulator→ID (e.g., { 'SEC': 'CIK-1234' })"),
    settlementProtocol: z.enum(['T+1', 'T+2', 'T+0_instant', 'blockchain']).optional(),
    lastAuditDate: z.string().nullable().describe("ISO date of last audit"),
});

export const FINANCE_VOCABULARY = {
    canonicalTerms: ['risk', 'return', 'settlement', 'compliance', 'exposure', 'liquidity', 'volatility'],
    sectorId: 'finance',
    version: '1.0.0',
} as const;
