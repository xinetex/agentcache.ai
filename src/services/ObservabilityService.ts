/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { redis } from '../lib/redis.js';
import { otelBridge } from './OpenTelemetryBridge.js';

export interface TelemetryEvent {
    id: string;
    type: 'RESONANCE' | 'CONFLICT' | 'POLICY' | 'MEMORY' | 'CLAWBACK' | 'REPUTATION_UPDATE' | 'RECOVERY_PLAN' | 'CACHE_OPERATION';
    timestamp: number;
    sector?: string;
    description: string;
    metadata: any;
}

/**
 * ObservabilityService: The "Nervous System" of AgentCache.
 * 
 * It aggregates high-fidelity signals from the infrastructure and
 * streams them via Redis for real-time visualization in the Dashboard.
 */
export class ObservabilityService {
    private readonly CHANNEL = 'agentcache:telemetry';

    /**
     * Track a system event and broadcast it to the observability stream.
     */
    async track(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): Promise<void> {
        const fullEvent: TelemetryEvent = {
            ...event,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        };

        // 1. Log to console for local visibility
        console.log(`[Observability] 📡 Event: ${fullEvent.type} - ${fullEvent.description}`);

        // 3. Broadcast for real-time dashboard
        await redis.publish(this.CHANNEL, JSON.stringify(event));

        // 4. Export to OpenTelemetry (Phase 13)
        await otelBridge.exportEvent(fullEvent);

        // 3. (Optional) Store recent history in a Redis list for Dashboard recovery
        await redis.lpush(`${this.CHANNEL}:history`, JSON.stringify(fullEvent));
        await redis.ltrim(`${this.CHANNEL}:history`, 0, 999); // Keep last 1000 events
    }

    /**
     * Get recent telemetry history.
     */
    async getHistory(limit: number = 100): Promise<TelemetryEvent[]> {
        const raw = await redis.lrange(`${this.CHANNEL}:history`, 0, limit - 1);
        return raw.map(r => JSON.parse(r as string));
    }
}

export const observabilityService = new ObservabilityService();
