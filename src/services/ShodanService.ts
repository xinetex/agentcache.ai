/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { ShodanClient } from '../lib/shodan.js';
import { redis } from '../lib/redis.js';

export interface InfrastructureRisk {
    ip: string;
    riskScore: number; // 0-10
    vulnerabilities: string[];
    ports: number[];
    org: string;
    lastSeen: string;
}

export class ShodanService {
    private client: ShodanClient;
    private CACHE_TTL = 3600 * 24; // 24 hours

    constructor() {
        this.client = new ShodanClient();
    }

    /**
     * Get risk profile for an IP, with caching
     */
    async getRiskProfile(ip: string): Promise<InfrastructureRisk> {
        const cacheKey = `risk:shodan:${ip}`;
        
        // 1. Try Cache
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached as string);
        }

        // 2. Fetch from Shodan
        const host = await this.client.getHost(ip);
        
        let risk: InfrastructureRisk;
        
        if (!host) {
            risk = {
                ip,
                riskScore: 0,
                vulnerabilities: [],
                ports: [],
                org: 'Unknown',
                lastSeen: new Date().toISOString()
            };
        } else {
            // Simple heuristic for risk score (can be improved)
            const vulnFactor = (host.vulns?.length || 0) * 2;
            const portFactor = host.ports.length * 0.5;
            const riskScore = Math.min(10, vulnFactor + portFactor);

            risk = {
                ip: host.ip_str,
                riskScore,
                vulnerabilities: host.vulns || [],
                ports: host.ports,
                org: host.org,
                lastSeen: new Date().toISOString()
            };
        }

        // 3. Store in Cache
        await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(risk));

        return risk;
    }
}

export const shodanService = new ShodanService();
