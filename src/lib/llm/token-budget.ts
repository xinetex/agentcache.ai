/**
 * Token Budget Tracker
 * 
 * Central accounting for LLM spend with circuit breaker functionality.
 * Prevents runaway costs by enforcing daily spend limits.
 * 
 * Environment Variables:
 * - MAX_DAILY_SPEND_USD: Maximum allowed spend per day (default: 10)
 * - TOKEN_BUDGET_RESET_HOUR: Hour of day (UTC) to reset budget (default: 0)
 */

export interface TokenSpend {
    timestamp: Date;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    taskType: string;
}

export interface BudgetStatus {
    dailySpendUsd: number;
    dailyLimitUsd: number;
    remainingUsd: number;
    isBlocked: boolean;
    callCount: number;
    lastReset: Date;
}

// Cost per 1M tokens (input) by provider/model
const COST_MATRIX: Record<string, Record<string, number>> = {
    ollama: { 'default': 0 },
    anthropic: {
        'claude-3-5-haiku': 0.25,
        'claude-3-5-sonnet': 3.00,
        'claude-3-opus': 15.00
    },
    openai: {
        'gpt-4o-mini': 0.15,
        'gpt-4o': 5.00,
        'o1-preview': 15.00,
        'o1': 15.00
    },
    moonshot: {
        'moonshot-v1-8k': 0.12,
        'kimi-latest': 0.15
    },
    perplexity: {
        'default': 0.20
    },
    grok: {
        'grok-2': 2.00
    }
};

class TokenBudget {
    private spendLog: TokenSpend[] = [];
    private lastResetDate: Date;
    private maxDailySpend: number;
    private redisSpendKey: string = '';

    constructor() {
        this.maxDailySpend = parseFloat(process.env.MAX_DAILY_SPEND_USD || '10');
        this.lastResetDate = new Date();
        this.resetIfNewDay();
    }

    /** Get today's Redis key for persistent spend tracking */
    private getTodayKey(): string {
        const now = new Date();
        const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
        return `budget:daily:${date}`;
    }

    /**
     * Check if a new day has started and reset the budget
     */
    private resetIfNewDay(): void {
        const now = new Date();
        const resetHour = parseInt(process.env.TOKEN_BUDGET_RESET_HOUR || '0', 10);

        // Create a date for today's reset time
        const todayReset = new Date(now);
        todayReset.setUTCHours(resetHour, 0, 0, 0);

        // If we're past the reset time, use today; otherwise use yesterday
        const effectiveReset = now >= todayReset ? todayReset : new Date(todayReset.getTime() - 24 * 60 * 60 * 1000);

        if (this.lastResetDate < effectiveReset) {
            console.log(`[TokenBudget] New day detected. Resetting budget. Previous spend: $${this.getDailySpend().toFixed(4)}`);
            this.spendLog = this.spendLog.filter(s => s.timestamp >= effectiveReset);
            this.lastResetDate = effectiveReset;
        }
    }

    /**
     * Get estimated cost for a request
     */
    estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
        const providerCosts = COST_MATRIX[provider.toLowerCase()] || COST_MATRIX['openai'];
        const costPer1M = providerCosts[model] || providerCosts['default'] || 1.00;

        // Input and output typically have different costs, but we simplify here
        // Output is usually 3-4x more expensive than input
        const inputCost = (inputTokens / 1_000_000) * costPer1M;
        const outputCost = (outputTokens / 1_000_000) * costPer1M * 3;

        return inputCost + outputCost;
    }

    /**
     * Check if we can afford a request
     */
    canSpend(estimatedCostUsd: number): boolean {
        this.resetIfNewDay();
        const remaining = this.maxDailySpend - this.getDailySpend();
        return estimatedCostUsd <= remaining;
    }

    /**
     * Record a completed LLM call (persists to Redis for cross-invocation tracking)
     */
    recordSpend(spend: TokenSpend): void {
        this.spendLog.push(spend);

        // Persist to Redis (fire-and-forget for speed)
        this.persistSpend(spend.costUsd).catch(err =>
            console.warn('[TokenBudget] Redis persist failed:', err)
        );

        console.log(`[TokenBudget] Recorded: ${spend.provider}/${spend.model} | ${spend.taskType} | $${spend.costUsd.toFixed(4)} | Total: $${this.getDailySpend().toFixed(4)}/${this.maxDailySpend}`);
    }

    /** Atomically increment daily spend in Redis */
    private async persistSpend(costUsd: number): Promise<void> {
        try {
            const { redis } = await import('../redis.js');
            const key = this.getTodayKey();
            await redis.incrbyfloat(key, costUsd);
            // Auto-expire after 48 hours to avoid unbounded key growth
            await redis.expire(key, 172800);
        } catch (e) {
            // Silently fail — in-memory log is the fallback
        }
    }

    /** Get persistent daily spend from Redis (for cold starts) */
    async getPersistedDailySpend(): Promise<number> {
        try {
            const { redis } = await import('../redis.js');
            const raw = await redis.get(this.getTodayKey());
            return parseFloat(String(raw ?? '0')) || 0;
        } catch {
            return 0;
        }
    }

    /**
     * Get total spend for today
     */
    getDailySpend(): number {
        return this.spendLog.reduce((sum, s) => sum + s.costUsd, 0);
    }

    /**
     * Get full budget status
     */
    getStatus(): BudgetStatus {
        this.resetIfNewDay();
        const dailySpend = this.getDailySpend();
        return {
            dailySpendUsd: dailySpend,
            dailyLimitUsd: this.maxDailySpend,
            remainingUsd: Math.max(0, this.maxDailySpend - dailySpend),
            isBlocked: dailySpend >= this.maxDailySpend,
            callCount: this.spendLog.length,
            lastReset: this.lastResetDate
        };
    }

    /**
     * Get spend breakdown by provider
     */
    getSpendByProvider(): Record<string, number> {
        const breakdown: Record<string, number> = {};
        for (const s of this.spendLog) {
            breakdown[s.provider] = (breakdown[s.provider] || 0) + s.costUsd;
        }
        return breakdown;
    }

    /**
     * Get spend breakdown by task type
     */
    getSpendByTask(): Record<string, number> {
        const breakdown: Record<string, number> = {};
        for (const s of this.spendLog) {
            breakdown[s.taskType] = (breakdown[s.taskType] || 0) + s.costUsd;
        }
        return breakdown;
    }

    /**
     * Export recent spend log for API/dashboard
     */
    getRecentSpend(limit: number = 50): TokenSpend[] {
        return this.spendLog.slice(-limit);
    }

    /**
     * Manually adjust the daily limit (admin function)
     */
    setDailyLimit(usd: number): void {
        console.log(`[TokenBudget] Daily limit updated: $${this.maxDailySpend} → $${usd}`);
        this.maxDailySpend = usd;
    }
}

// Singleton instance
export const tokenBudget = new TokenBudget();
