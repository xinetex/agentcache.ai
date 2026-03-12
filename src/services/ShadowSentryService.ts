/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * ShadowSentryService: Encapsulates environmental risk correlation 
 * and auto-quarantine logic for the Semantic Cache.
 */

import { shodanService } from './ShodanService.js';
import { bancacheService } from './BancacheService.js';
import { eventBus } from '../lib/event-bus.js';

export interface RiskAssessmentParams {
    target_ip?: string;
    target_banner?: string;
    drift: number;
    sessionId?: string;
}

export interface RiskAssessmentResult {
    riskScore: number;
    quarantined: boolean;
}

export class ShadowSentryService {
    /**
     * Assess environmental risk based on IP and Banner intelligence,
     * correlating with semantic drift for auto-quarantine decisions.
     */
    async assessRisk(params: RiskAssessmentParams): Promise<RiskAssessmentResult> {
        let environmentalRisk = 0;
        let quarantined = false;

        if (params.target_ip || params.target_banner) {
            console.log(`[ShadowSentry] 🔍 Assessing IP: ${params.target_ip || 'none'}, Banner: ${params.target_banner ? 'present' : 'none'}`);
            
            const shodanRisk = params.target_ip 
                ? (await shodanService.getRiskProfile(params.target_ip)).riskScore 
                : 0;
            
            const bannerRisk = params.target_banner 
                ? (await bancacheService.analyzeBanner(params.target_banner)).riskScore 
                : 0;
            
            environmentalRisk = Math.max(shodanRisk, bannerRisk);
            console.log(`[ShadowSentry] 🛡️ Risk Score: ${environmentalRisk} (Shodan: ${shodanRisk}, Banner: ${bannerRisk})`);

            // AUTO-QUARANTINE LOGIC: Drift + Environmental Risk
            if (params.drift > 0.1 && environmentalRisk > 7.0) {
                quarantined = true;
                console.log(`[ShadowSentry] 🚨 AUTO-QUARANTINE: Drift (${params.drift.toFixed(2)}) correlated with Risk (${environmentalRisk}).`);
                
                eventBus.emit('quarantine_event', {
                    sessionId: params.sessionId,
                    drift: params.drift,
                    environmentalRisk,
                    target_ip: params.target_ip
                });
            }
        }

        return {
            riskScore: environmentalRisk,
            quarantined
        };
    }
}

export const shadowSentryService = new ShadowSentryService();
