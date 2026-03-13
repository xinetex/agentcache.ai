/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * ShadowValueInvoiceGenerator: Quantifies "Shadow Value" (Δm) into readable reports.
 */

import { maturityEngine } from './MaturityEngine.js';
import { redis } from '../lib/redis.js';

export interface ShadowInvoice {
    id: string;
    clientId: string;
    periodStart: string;
    periodEnd: string;
    totalShadowValue: number;
    details: {
        taskKey: string;
        maturityLevel: number;
        contribution: number;
    }[];
}

export class ShadowValueInvoiceGenerator {
    /**
     * Generate a report of unbilled utility for a client.
     */
    async generateReport(clientId: string): Promise<ShadowInvoice> {
        const shadowValue = await maturityEngine.getMeasurabilityGap(clientId);
        
        // Mocking detailed breakdown for now based on maturity levels
        // In a real system, this would query the maturity_ledger for specific timeframes
        const invoice: ShadowInvoice = {
            id: `INV-Δm-${Math.random().toString(36).substring(7).toUpperCase()}`,
            clientId,
            periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            periodEnd: new Date().toISOString(),
            totalShadowValue: shadowValue,
            details: [
                { taskKey: 'compliance-check', maturityLevel: 3, contribution: shadowValue * 0.7 },
                { taskKey: 'market-scan', maturityLevel: 2, contribution: shadowValue * 0.3 }
            ]
        };

        console.log(`[ShadowInvoice] report generated for ${clientId}: $${shadowValue}`);
        await redis.set(`b2b:invoice:${invoice.id}`, JSON.stringify(invoice));
        
        return invoice;
    }

    async getInvoicesForClient(clientId: string): Promise<ShadowInvoice[]> {
        // Simple mock of list retrieval
        const keys = await redis.keys('b2b:invoice:*');
        const invoices = await Promise.all(keys.map(async k => JSON.parse(await redis.get(k) || '{}')));
        return invoices.filter(i => i.clientId === clientId);
    }
}

export const shadowValueInvoiceGenerator = new ShadowValueInvoiceGenerator();
