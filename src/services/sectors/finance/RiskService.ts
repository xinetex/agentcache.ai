
import { redis } from '../../../lib/redis.js';
import { stableHash } from '../../../lib/stable-json.js';
import { BillingService, PRICING } from '../../BillingService.js';
import { CortexBridge } from '../../CortexBridge.js';

interface RiskRequest {
    portfolio: Record<string, number>; // { "BTC": 0.5, "USD": 0.5 }
    scenario: "baseline" | "crash" | "pump" | "rate_hike";
    iterations?: number;
}

interface RiskResult {
    var_95: number; // Value at Risk (95% confidence)
    expected_return: number;
    simulated_paths: number;
    from_cache: boolean;
    latency_ms: number;
}

export class RiskService {

    private generateCacheKey(req: RiskRequest): string {
        return `finance:risk:${stableHash(req)}`;
    }

    async execute(req: RiskRequest): Promise<RiskResult> {
        // Billing Check
        const billing = new BillingService();
        await billing.charge(PRICING.RISK_ASSESS, "RiskCache: Monte Carlo");

        const key = this.generateCacheKey(req);
        const startTime = Date.now();

        // 1. Check Cache
        try {
            const cached = await redis.get(key);
            if (cached) {
                // Cache Hit
                const latency = Date.now() - startTime;
                await this.updateStats(true, 100); // 100ms compute saved

                return {
                    ...JSON.parse(cached),
                    from_cache: true,
                    latency_ms: latency
                };
            }
        } catch (e) {
            console.warn('[RiskService] Cache fail', e);
        }

        // 2. Perform Monte Carlo Simulation (CPU Intensive)
        // Simulate 10,000 runs
        await new Promise(resolve => setTimeout(resolve, 150)); // Simulated delay

        const result = {
            var_95: Math.random() * 0.15, // Mock calculation
            expected_return: Math.random() * 0.05,
            simulated_paths: req.iterations || 10000
        };

        // Cache It
        await redis.setex(key, 60, JSON.stringify(result));

        // CORTEX INTEGRATION: Detect Anomalies
        if (req.scenario === 'crash' || result.var_95 > 0.10) {
            const cortex = new CortexBridge();
            await cortex.synapse({
                sector: "FINANCE",
                type: "WARNING",
                message: `High Volatility Detected (VaR: ${(result.var_95 * 100).toFixed(1)}%)`,
                data: { scenario: req.scenario }
            });
        }

        const latency = Date.now() - startTime;
        await this.updateStats(false, 0);

        return {
            ...result,
            from_cache: false,
            latency_ms: latency
        };
    }

    // Telemetry
    async getStats() {
        const totalStr = await redis.get('finance:stats:requests') as string | null;
        const hitsStr = await redis.get('finance:stats:hits') as string | null;
        const savedStr = await redis.get('finance:stats:saved_ms') as string | null;

        return {
            total_requests: parseInt(totalStr || '0'),
            cache_hits: parseInt(hitsStr || '0'),
            saved_time_ms: parseInt(savedStr || '0')
        };
    }

    private async updateStats(hit: boolean, savedMs: number) {
        try {
            const p = redis.pipeline();
            p.incr('finance:stats:requests');
            if (hit) {
                p.incr('finance:stats:hits');
                p.incrby('finance:stats:saved_ms', savedMs);
            }
            await p.exec();
        } catch (e) {
            // Mock redis handles or ignores
        }
    }
}
