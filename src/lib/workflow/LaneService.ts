
import { Redis } from '@upstash/redis';

interface AgentJob {
    id: string;
    type: string;
    payload: any;
    meta: {
        timestamp: number;
        traceId: string;
    };
}

export class LaneService {
    private redis: Redis | null = null;

    constructor() {
        // Fallback for local development or missing env
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            try {
                this.redis = Redis.fromEnv();
            } catch (e) {
                console.warn('[LaneService] Failed to initialize Redis:', e);
            }
        } else {
            console.warn('[LaneService] Redis env missing. Queue operations will be no-ops.');
        }
    }

    /**
     * Dispatch a job to a specific Lane
     */
    async dispatch(lane: string, type: string, payload: any): Promise<string> {
        const job: AgentJob = {
            id: crypto.randomUUID(),
            type,
            payload,
            meta: {
                timestamp: Date.now(),
                traceId: crypto.randomUUID()
            }
        };

        if (this.redis) {
            await this.redis.rpush(`queue:${lane}`, JSON.stringify(job));
            return job.id;
        }
        return "mock-id";
    }

    /**
     * Poll a lane for the next job
     */
    async poll(lane: string): Promise<AgentJob | null> {
        if (!this.redis) return null;

        // Polling from left
        const raw = await this.redis.lpop(`queue:${lane}`);
        if (!raw) return null;

        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
}
