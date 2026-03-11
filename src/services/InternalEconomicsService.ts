
import { redis } from '../lib/redis.js';

export interface PlatformEconomics {
    dailyComputeCents: number;
    dailyRedisOps: number;
    dailyVectorIops: number;
    totalDailyCostUsd: number;
    isThrottled: boolean;
}

/**
 * InternalEconomicsService
 * 
 * Prevents "Vercel Fund Swallowing" by tracking platform-level overhead.
 * If the platform's own maintenance costs (invalidations, boids, drift checks)
 * exceed a safety threshold, it auto-throttles low-priority background workers.
 */
export class InternalEconomicsService {
    private readonly DAILY_PLATFORM_BUDGET_USD = parseFloat(process.env.PLATFORM_DAILY_BUDGET_USD || '1.00');
    private readonly VERCEL_EXECUTION_COST_PER_MS = 0.00000002; // Rough estimate
    private readonly REDIS_OP_COST = 0.00001; // $0.01 per 1000 ops estimate

    private getTodayKey(): string {
        return `platform:economics:${new Date().toISOString().slice(0, 10)}`;
    }

    /**
     * Record an internal overhead event
     */
    async recordOverhead(executionMs: number, redisOps: number = 1): Promise<void> {
        const key = this.getTodayKey();
        const cost = (executionMs * this.VERCEL_EXECUTION_COST_PER_MS) + (redisOps * this.REDIS_OP_COST);
        
        try {
            await Promise.all([
                redis.incrbyfloat(`${key}:cost`, cost),
                redis.incr(`${key}:ops`, redisOps),
                redis.expire(`${key}:cost`, 86400 * 7)
            ]);
        } catch (e) {
            console.warn("[Economics] Failed to record overhead:", e);
        }
    }

    /**
     * Determine if we should throttle background maintenance
     */
    async shouldThrottle(): Promise<boolean> {
        const cost = await this.getDailyCost();
        const isThrottled = cost >= this.DAILY_PLATFORM_BUDGET_USD;
        
        if (isThrottled) {
            console.warn(`[Economics] PLATFORM BUDGET EXCEEDED ($${cost.toFixed(4)}). Auto-throttling background workers.`);
        }
        
        return isThrottled;
    }

    async getDailyCost(): Promise<number> {
        const key = this.getTodayKey();
        const raw = await redis.get(`${key}:cost`);
        return parseFloat(String(raw ?? '0')) || 0;
    }

    async getStatus(): Promise<PlatformEconomics> {
        const cost = await this.getDailyCost();
        const key = this.getTodayKey();
        const ops = await redis.get(`${key}:ops`);
        
        return {
            dailyComputeCents: (cost * 100),
            dailyRedisOps: parseInt(String(ops ?? '0')),
            dailyVectorIops: 0, // Placeholder
            totalDailyCostUsd: cost,
            isThrottled: cost >= this.DAILY_PLATFORM_BUDGET_USD
        };
    }
}

export const internalEconomics = new InternalEconomicsService();
