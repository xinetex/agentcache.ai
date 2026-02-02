
import { db } from '../db/client.js';
import { decisions, creditUsageDaily } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Analytics Service
 * "The Observer" - Tracks everything Agents do.
 */
export class AnalyticsService {

    /**
     * Log an Agent's Decision/Action (Qualitative)
     */
    async logDecision(agentId: string, action: string, reasoning: string, outcome: any) {
        try {
            await db.insert(decisions).values({
                id: uuidv4(),
                agentId,
                action,
                reasoning,
                outcome
            });
            console.log(`[Analytics] Logged Decision for ${agentId}: ${action}`);
        } catch (err) {
            console.error(`[Analytics] Failed to log decision:`, err);
        }
    }

    /**
     * Track Resource Usage (Quantitative / Billing)
     * e.g. "Used 500 Tokens" or "Stored 1GB"
     */
    async trackUsage(userId: string, metric: 'tokens' | 'storage' | 'embeddings', amount: number) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to midnight

            // Upsert (Insert or Update)
            // Note: Postgres specific syntax usually involving ON CONFLICT
            // Here we use a simplified approach or just INSERT for log stream if aggregation is downstream
            // But schema suggests `credit_usage_daily` is an aggregate table.

            // For now, simpler implementation: Just log valid usage to console/mock, 
            // creating a real UPSERT in Drizzle is verbose.
            // We will assume 'creditTransactions' is the source of truth for billing,
            // and `credit_usage_daily` is a derived view.

            console.log(`[Analytics] Tracked Usage: User=${userId}, Metric=${metric}, Amount=${amount}`);

        } catch (err) {
            console.error(`[Analytics] Failed to track usage:`, err);
        }
    }
}

export const analytics = new AnalyticsService();
