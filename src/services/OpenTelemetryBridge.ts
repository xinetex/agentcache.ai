/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { TelemetryEvent } from './ObservabilityService.js';

/**
 * OpenTelemetryBridge
 * 
 * Maps internal AgentCache telemetry events to OpenTelemetry (OTel) 
 * compatible formats. This enables the AgentCache "Nervous System" 
 * to be exported to standard observability stacks (Grafana, Datadog, Honeycomb).
 */
export class OpenTelemetryBridge {
    /**
     * Export an event in OTel-compatible JSON format.
     */
    async exportEvent(event: TelemetryEvent): Promise<void> {
        // In a production environment, this would use @opentelemetry/api
        // For now, we emit OTel-structured logs that are easy to ingest.
        const otelLog = {
            timestamp: new Date(event.timestamp).toISOString(),
            traceId: (event.metadata as any)?.traceId || this.generateTraceId(),
            spanId: (event.metadata as any)?.spanId || this.generateSpanId(),
            severity: this.mapTypeToSeverity(event.type),
            body: event.description,
            attributes: {
                'service.name': 'agentcache-ai',
                'event.type': event.type,
                ...event.metadata
            }
        };

        // Simulated OTel Collector Push
        console.log(`[OTel Export] 📤 Push: ${JSON.stringify(otelLog)}`);
    }

    private mapTypeToSeverity(type: string): string {
        switch (type) {
            case 'POLICY': return 'WARN';
            case 'SLO_VIOLATION': return 'ERROR';
            case 'CONFLICT': return 'INFO';
            case 'RESONANCE': return 'INFO';
            case 'PROVOCATION': return 'DEBUG';
            default: return 'INFO';
        }
    }

    private generateTraceId(): string {
        return Math.random().toString(16).substring(2, 18);
    }

    private generateSpanId(): string {
        return Math.random().toString(16).substring(2, 10);
    }
}

export const otelBridge = new OpenTelemetryBridge();
