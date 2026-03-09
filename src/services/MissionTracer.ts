import { v4 as uuidv4 } from 'uuid';
import { Tracer } from '../lib/observability/tracer.js';

/**
 * MissionTracer: Provides high-level cognitive observability for autonomous missions.
 * Wraps the base Tracer to provide specialized agent-task tracking.
 */
export class MissionTracer {
    private tracer: Tracer;

    constructor() {
        this.tracer = new Tracer({
            redisUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL,
            redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
            traceId: uuidv4()
        });
    }

    async startMission(goal: string) {
        const span = this.tracer.startSpan('mission_execution', { goal });
        // We'll keep the mission span active until endMission is called
        (this as any)._missionSpan = span;
        console.log(`[MissionTracer] 🛰️ Mission Started: ${this.tracer.getTraceId()}`);
        return this.tracer.getTraceId();
    }

    async trackStep(step: { id: string; type: string; metadata?: any }): Promise<string> {
        const span = this.tracer.startSpan(step.id, { ...step, status: 'active' });
        (this as any)[`_step_${step.id}`] = span;
        return step.id;
    }

    async completeStep(stepId: string, result?: any) {
        const span = (this as any)[`_step_${stepId}`];
        if (span) {
            span.attributes.result = result;
            this.tracer.endSpan(span);
        }
    }

    async endMission(summary?: string) {
        const span = (this as any)._missionSpan;
        if (span) {
            span.attributes.summary = summary;
            this.tracer.endSpan(span);
        }
        await this.tracer.flush();
        console.log(`[MissionTracer] ✅ Mission Complete: ${this.tracer.getTraceId()}`);
    }

    getMissionId() {
        return this.tracer.getTraceId();
    }
}

export const missionTracer = new MissionTracer();
