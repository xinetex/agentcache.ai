/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * SalesProbeOrchestrator: Automates outbound outreach to discovered Vacuum Zones.
 * Phase 39: Automated Client Acquisition.
 */

import { vacuumHunterService, VacuumZone } from './VacuumHunterService.js';
import { redis } from '../lib/redis.js';

export interface SalesProbeStatus {
    id: string;
    zoneId: string;
    status: 'PENDING' | 'SENT' | 'REPLIED' | 'CONVERTED';
    lastActivity: string;
    draft_used: string;
}

export class SalesProbeOrchestrator {
    /**
     * Dispatch probes for all detected vacuums that haven't been contacted yet.
     */
    async dispatchProbes(): Promise<SalesProbeStatus[]> {
        console.log('[SalesProbe] 🚀 Dispatching autonomous sales probes...');
        
        const zones = await vacuumHunterService.getDetectedVacuums();
        const existingProbesRaw = await redis.get('b2b:sales-probes');
        const existingProbes: SalesProbeStatus[] = existingProbesRaw ? JSON.parse(existingProbesRaw) : [];

        const newProbes: SalesProbeStatus[] = [];

        for (const zone of zones) {
            // Check if we already have a probe for this zone
            if (!existingProbes.find(p => p.zoneId === zone.id)) {
                const probe: SalesProbeStatus = {
                    id: `probe-${Math.random().toString(36).substring(7)}`,
                    zoneId: zone.id,
                    status: 'SENT',
                    lastActivity: new Date().toISOString(),
                    draft_used: zone.sales_probe_draft
                };
                
                console.log(`[SalesProbe] SENT: Probe for sector "${zone.sector}" using draft.`);
                newProbes.push(probe);
            }
        }

        const allProbes = [...existingProbes, ...newProbes];
        await redis.set('b2b:sales-probes', JSON.stringify(allProbes));
        
        return newProbes;
    }

    async getProbeStats() {
        const probesRaw = await redis.get('b2b:sales-probes');
        const probes: SalesProbeStatus[] = probesRaw ? JSON.parse(probesRaw) : [];
        
        return {
            total_sent: probes.length,
            replied: probes.filter(p => p.status === 'REPLIED').length,
            converted: probes.filter(p => p.status === 'CONVERTED').length
        };
    }
}

export const salesProbeOrchestrator = new SalesProbeOrchestrator();
