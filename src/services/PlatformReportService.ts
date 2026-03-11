import { db } from '../db/client.js';
import { ledgerAccounts, ledgerTransactions, creditTransactions, hubAgents, apiKeys } from '../db/schema.js';
import { sql, eq, gte, count, sum } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import { ontologyRegistry } from '../ontology/OntologyRegistry.js';
import { ontologyCacheStrategy } from '../ontology/OntologyCacheStrategy.js';
import { MASTER_TREASURY_ID } from './AgentSettlementService.js';

/**
 * PlatformReportService: The single source of truth for platform revenue and usage metrics.
 * 
 * Aggregates from 3 data sources:
 * 1. Neon (Postgres): ledgerTransactions, creditTransactions, accounts
 * 2. Redis: ontology cache metrics, API usage counters, billing ledger
 * 3. OntologyRegistry: sector configuration (for cache savings estimates)
 */
export class PlatformReportService {

    /**
     * Full platform report — the "How much money have we made?" answer.
     */
    async getFullReport(): Promise<any> {
        const [revenue, ontology, agents, credits, usage, qr] = await Promise.all([
            this.getRevenueMetrics(),
            this.getOntologyMetrics(),
            this.getAgentMetrics(),
            this.getCreditMetrics(),
            this.getUsageMetrics(),
            this.getQrMetrics(),
        ]);

        return {
            generatedAt: new Date().toISOString(),
            revenue,
            ontology,
            agents,
            credits,
            usage,
            qr,
        };
    }

    /**
     * Revenue metrics from the Ledger (real money flow).
     * x402 settlements flow: Agent → Treasury (MASTER_TREASURY_ID)
     */
    async getRevenueMetrics(): Promise<any> {
        try {
            // Total revenue = all transfers TO the treasury
            const treasuryAccount = await db.select()
                .from(ledgerAccounts)
                .where(eq(ledgerAccounts.ownerId, MASTER_TREASURY_ID))
                .limit(1);

            const treasuryBalance = treasuryAccount[0]?.balance || 0;

            // Count and sum all settlements
            const settlements = await db.select({
                count: count(),
                total: sum(ledgerTransactions.amount),
            }).from(ledgerTransactions)
            .where(eq(ledgerTransactions.toAccountId, treasuryAccount[0]?.id || ''));

            // Recent settlements (last 24h)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentSettlements = await db.select({
                count: count(),
                total: sum(ledgerTransactions.amount),
            }).from(ledgerTransactions)
            .where(sql`${ledgerTransactions.toAccountId} = ${treasuryAccount[0]?.id || ''} AND ${ledgerTransactions.createdAt} >= ${oneDayAgo}`);

            // Active ledger accounts
            const accountsResult = await db.select({ count: count() }).from(ledgerAccounts);

            return {
                treasuryBalance,
                totalSettlements: Number(settlements[0]?.count || 0),
                totalRevenue: Number(settlements[0]?.total || 0),
                last24h: {
                    settlements: Number(recentSettlements[0]?.count || 0),
                    revenue: Number(recentSettlements[0]?.total || 0),
                },
                activeLedgerAccounts: Number(accountsResult[0]?.count || 0),
                currency: 'USDC',
            };
        } catch (e: any) {
            console.error('[PlatformReport] Revenue metrics error:', e.message);
            return { error: e.message, treasuryBalance: 0, totalRevenue: 0 };
        }
    }

    /**
     * Ontology-specific metrics: cache savings, sector usage, cost avoidance.
     */
    async getOntologyMetrics(): Promise<any> {
        const sectors = ontologyRegistry.listAll();
        const sectorMetrics: any[] = [];

        // Estimated LLM cost per ontology mapping (Inception Mercury pricing)
        const ESTIMATED_LLM_COST_PER_CALL = 0.003; // ~$0.003 per mapping call

        let totalHits = 0;
        let totalMisses = 0;

        for (const sector of sectors) {
            const metrics = await ontologyCacheStrategy.getMetrics(sector.sectorId);
            totalHits += metrics.hits;
            totalMisses += metrics.misses;

            sectorMetrics.push({
                sectorId: sector.sectorId,
                name: sector.name,
                ...metrics,
                estimatedCostSaved: metrics.hits * ESTIMATED_LLM_COST_PER_CALL,
            });
        }

        const totalCalls = totalHits + totalMisses;

        return {
            totalOntologyCalls: totalCalls,
            cacheHits: totalHits,
            cacheMisses: totalMisses,
            cacheHitRatio: totalCalls > 0 ? totalHits / totalCalls : 0,
            estimatedLlmCostSaved: totalHits * ESTIMATED_LLM_COST_PER_CALL,
            sectorsRegistered: sectors.length,
            sectorBreakdown: sectorMetrics,
        };
    }

    /**
     * Agent ecosystem metrics.
     */
    async getAgentMetrics(): Promise<any> {
        try {
            const totalResult = await db.select({ count: count() }).from(hubAgents);

            // Agents active in last 24h
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const activeResult = await db.select({ count: count() })
                .from(hubAgents)
                .where(gte(hubAgents.updatedAt, oneDayAgo));

            return {
                totalRegistered: Number(totalResult[0]?.count || 0),
                activeLast24h: Number(activeResult[0]?.count || 0),
            };
        } catch (e: any) {
            console.error('[PlatformReport] Agent metrics error:', e.message);
            return { totalRegistered: 0, activeLast24h: 0, error: e.message };
        }
    }

    /**
     * Credit economy metrics (purchases, usage, burn rate).
     */
    async getCreditMetrics(): Promise<any> {
        try {
            // Total purchases
            const purchases = await db.select({
                count: count(),
                total: sum(creditTransactions.amount),
            }).from(creditTransactions)
            .where(eq(creditTransactions.type, 'purchase'));

            // Total usage
            const usage = await db.select({
                count: count(),
                total: sum(creditTransactions.amount),
            }).from(creditTransactions)
            .where(eq(creditTransactions.type, 'usage'));

            // Active API keys
            const keysResult = await db.select({ count: count() })
                .from(apiKeys)
                .where(eq(apiKeys.isActive, true));

            return {
                totalPurchases: Number(purchases[0]?.count || 0),
                purchaseRevenue: Math.abs(Number(purchases[0]?.total || 0)),
                totalUsageEvents: Number(usage[0]?.count || 0),
                creditsConsumed: Math.abs(Number(usage[0]?.total || 0)),
                activeApiKeys: Number(keysResult[0]?.count || 0),
            };
        } catch (e: any) {
            console.error('[PlatformReport] Credit metrics error:', e.message);
            return { error: e.message };
        }
    }

    /**
     * Usage metrics from Redis (API request counters).
     */
    async getUsageMetrics(): Promise<any> {
        try {
            // Get this month's key pattern
            const now = new Date();
            const monthKey = now.toISOString().slice(0, 7); // "2026-03"

            // We can't easily iterate all usage keys without SCAN, so we report what we know
            const billingLedger = await redis.lrange(`billing:master_treasury:ledger`, 0, 9);
            const recentTransactions = billingLedger.map(s => {
                try { return JSON.parse(s); } catch { return null; }
            }).filter(Boolean);

            return {
                currentMonth: monthKey,
                recentBillingTransactions: recentTransactions.length,
                recentTransactions: recentTransactions.slice(0, 5), // Last 5 for preview
            };
        } catch (e: any) {
            console.error('[PlatformReport] Usage metrics error:', e.message);
            return { error: e.message };
        }
    }

    /**
     * QR Pairing metrics (from qr_pairing_codes table).
     */
    async getQrMetrics(): Promise<any> {
        try {
            const totalResult = await db.select({ count: count() }).from(sql`qr_pairing_codes` as any);
            const pendingResult = await db.select({ count: count() })
                .from(sql`qr_pairing_codes` as any)
                .where(sql`status = 'pending' AND expires_at > NOW()`);

            return {
                totalPairings: Number(totalResult[0]?.count || 0),
                activePending: Number(pendingResult[0]?.count || 0),
            };
        } catch (e: any) {
            console.warn('[PlatformReport] QR metrics error (table may not exist):', e.message);
            return { totalPairings: 0, activePending: 0 };
        }
    }

    /**
     * Autonomous Need Detection: Identifies "Need Pockets" where agentic pressure is required.
     * Criteria: High volume + Low Cache Hit Ratio = Optimization Needed.
     */
    async detectNeedPockets(): Promise<any[]> {
        const ontology = await this.getOntologyMetrics();
        const sectors = ontology.sectorBreakdown || [];
        const pockets: any[] = [];

        // Thresholds for "Need"
        const VOLUME_THRESHOLD = 50; // Min calls to consider a pocket
        const HIT_RATIO_SEVERE = 0.3; // Below 30% hit ratio is critical
        const HIT_RATIO_WARNING = 0.6; // Below 60% needs attention

        for (const sector of sectors) {
            const total = sector.hits + sector.misses;
            const ratio = total > 0 ? sector.hits / total : 1;

            if (total > VOLUME_THRESHOLD && ratio < HIT_RATIO_WARNING) {
                let severity = 'low';
                let recommendedSwarmSize = 2;

                if (ratio < HIT_RATIO_SEVERE) {
                    severity = 'high';
                    recommendedSwarmSize = 5;
                } else if (ratio < 0.5) {
                    severity = 'medium';
                    recommendedSwarmSize = 3;
                }

                pockets.push({
                    sectorId: sector.sectorId,
                    name: sector.name,
                    volume: total,
                    hitRatio: ratio,
                    severity,
                    recommendedSwarmSize,
                    reason: `Low cache efficiency (${(ratio * 100).toFixed(1)}%) in ${sector.name} sector.`
                });
            }
        }

        return pockets.sort((a, b) => b.volume - a.volume);
    }
}

export const platformReportService = new PlatformReportService();
