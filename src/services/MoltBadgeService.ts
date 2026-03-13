/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * MoltBadgeService: Verifiable reputation for the agentic economy.
 * Phase 36.1: Productionization.
 */

import jwt from 'jsonwebtoken';
import { reputationService } from './ReputationService.js';
import { redis } from '../lib/redis.js';

export interface ReputationBadge {
    agentId: string;
    score: number;
    status: string;
    issuer: string;
    iat: number;
    exp: number;
}

export class MoltBadgeService {
    private SECRET = process.env.REPUTATION_SIGNING_SECRET || 'agentcache_secret_alpha_99';
    private ISSUER = 'AgentCache-Cognitive-OS';

    /**
     * Issue a verifiable reputation badge for an agent.
     */
    async issueBadge(agentId: string): Promise<string> {
        console.log(`[MoltBadge] 🎖️ Issuing reputation badge for agent: ${agentId}`);

        const score = await reputationService.getReputation(agentId);
        
        const payload: ReputationBadge = {
            agentId,
            score,
            status: score > 0.8 ? 'TRUSTED' : score > 0.5 ? 'NEUTRAL' : 'SUSPICIOUS',
            issuer: this.ISSUER,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hour TTL
        };

        const token = jwt.sign(payload, this.SECRET);

        // Cache the badge for public verification
        await redis.set(`mesh:node:badge:${agentId}`, token, 'EX', 86400);

        return token;
    }

    /**
     * Verify a reputation badge.
     */
    verifyBadge(token: string): ReputationBadge | null {
        try {
            const decoded = jwt.verify(token, this.SECRET) as ReputationBadge;
            if (decoded.issuer !== this.ISSUER) return null;
            return decoded;
        } catch (error) {
            console.error('[MoltBadge] Verification failed:', error);
            return null;
        }
    }
}

export const moltBadgeService = new MoltBadgeService();
