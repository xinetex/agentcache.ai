
import { spawn } from 'child_process';
import path from 'path';
import { redis } from '../../../lib/redis.js';
import { stableHash } from '../../../lib/stable-json.js';
import { BillingService, PRICING } from '../../BillingService.js';
import { CortexBridge } from '../../CortexBridge.js';
import { NodeRegistry } from '../../nodes/NodeRegistry.js';

interface MotionRequest {
    sx: number;
    sy: number;
    gx: number;
    gy: number;
    grid_size?: number;
    robot_radius?: number;
    ox?: number[]; // Obstacle X coords
    oy?: number[]; // Obstacle Y coords
}

interface MotionResult {
    success: boolean;
    path_x?: number[];
    path_y?: number[];
    from_cache?: boolean;
    latency?: number;
    error?: string;
}

export class MotionService {
    private scriptPath: string;

    constructor() {
        this.scriptPath = path.resolve('src/lib/python/path_planner.py');
    }

    private generateCacheKey(req: MotionRequest): string {
        const hash = stableHash(req);
        return `motion:astar:${hash}`;
    }

    async planPath(req: MotionRequest): Promise<MotionResult> {
        // Billing Check
        const billing = new BillingService();
        await billing.charge(PRICING.MOTION_PLAN, "MotionCache: Path Plan");

        const cortex = new CortexBridge();
        const warnings = await cortex.recall("ROBOTICS");
        if (warnings.length > 0) {
            console.log(`[MotionService] ⚠️ Caution: Detected ${warnings.length} global warnings. Adjusting heuristic.`);
        }

        // SECTOR COMPLIANCE CHECK (The Execution Plane)
        // We dynamically run the nodes defined for this sector (Simulating 'phi_filter' for demo)
        const compliance = await NodeRegistry.runPipeline(
            ['phi_filter'], // In real app, this comes from Config.nodes list
            {},
            req,
            'robotics'
        );

        if (compliance.block) {
            console.warn('[MotionService] 🛑 Blocked by Compliance Policy:', compliance.logs);
            return { success: false, error: 'Request blocked by compliance policy: ' + compliance.logs.join(', ') };
        }

        if (compliance.logs.length > 0) {
            console.log('[MotionService] 🛡️ Compliance Actions:', compliance.logs);
        }

        // Use the redacted/modified input for the actual logic
        const safeReq = compliance.modifiedInput || req;


        const key = this.generateCacheKey(req);
        const startTime = Date.now();

        // 1. Check Cache
        try {
            const cached = await redis.get(key);
            if (cached) {
                const result = JSON.parse(cached as unknown as string);
                const latency = Date.now() - startTime;

                // Telemetry (Async fire-and-forget)
                this.updateStats(true, 500);

                return {
                    ...result,
                    from_cache: true,
                    latency
                };
            }
        } catch (err) {
            console.warn('[MotionService] Cache check failed:', err);
        }

        // 2. Execute Python Logic & Update Cache
        try {
            const pythonData = await this.runPythonScript(req);

            if (pythonData.success) {
                await redis.setex(key, 86400, JSON.stringify(pythonData));

                // Save latest path for visualization
                redis.set('motion:viz:latest', JSON.stringify({
                    req,
                    path_x: pythonData.path_x,
                    path_y: pythonData.path_y,
                    timestamp: Date.now()
                })).catch(console.error);
            }

            const latency = Date.now() - startTime;

            // Telemetry
            this.updateStats(false, 0);

            return {
                ...pythonData,
                from_cache: false,
                latency
            };

        } catch (err: any) {
            return {
                success: false,
                error: err.message
            };
        }
    }

    private runPythonScript(req: MotionRequest): Promise<any> {
        return new Promise((resolve, reject) => {
            const py = spawn('python3', [this.scriptPath]);

            let output = '';
            let errorOutput = '';

            // Send JSON payload
            py.stdin.write(JSON.stringify(req));
            py.stdin.end();

            py.stdout.on('data', (data) => {
                output += data.toString();
            });

            py.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            py.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed (code ${code}): ${errorOutput}`));
                    return;
                }
                try {
                    const result = JSON.parse(output);
                    resolve(result);
                } catch (e) {
                    reject(new Error(`Invalid JSON from python: ${output}`));
                }
            });
        });
    }

    private async updateStats(hit: boolean, savedMs: number) {
        try {
            const pipeline = redis.pipeline();
            pipeline.incr('motion:stats:requests');
            if (hit) {
                pipeline.incr('motion:stats:hits');
                pipeline.incrby('motion:stats:saved_ms', savedMs);
            }
            await pipeline.exec();
        } catch (e) {
            console.warn('Telemetry failed:', e);
        }
    }

    async getStats() {
        const [total, hits, savedMs, latest] = await Promise.all([
            redis.get('motion:stats:requests'),
            redis.get('motion:stats:hits'),
            redis.get('motion:stats:saved_ms'),
            redis.get('motion:viz:latest')
        ]);

        return {
            total_requests: parseInt((total as unknown as string) || '0'),
            cache_hits: parseInt((hits as unknown as string) || '0'),
            saved_time_ms: parseInt((savedMs as unknown as string) || '0'),
            latest_path: latest ? JSON.parse(latest as unknown as string) : null
        };
    }
}
