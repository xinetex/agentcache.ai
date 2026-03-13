/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * ReferralService: Manages cross-sector agent-to-agent referrals.
 * Phase 6: The Sentience Layer.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';
import { solanaEconomyService } from './SolanaEconomyService.js';

export interface Referral {
    id: string;
    referrerAgentId: string;
    refereeAgentId: string;
    taskKey: string;
    referralFee: number; // in SOL
    status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'EXPIRED';
    timestamp: string;
}

export class ReferralService {
    private readonly STANDARD_REFERRAL_FEE = 15.00; // SOL

    /**
     * Refer a task to another specialized agent.
     */
    async createReferral(referrerId: string, refereeId: string, taskKey: string): Promise<Referral> {
        console.log(`[ReferralService] 🤝 Agent ${referrerId} is referring ${taskKey} to ${refereeId}`);

        const id = createHash('sha256').update(`${referrerId}:${refereeId}:${taskKey}:${Date.now()}`).digest('hex').substring(0, 16);
        const referral: Referral = {
            id,
            referrerAgentId: referrerId,
            refereeAgentId: refereeId,
            taskKey,
            referralFee: this.STANDARD_REFERRAL_FEE,
            status: 'PENDING',
            timestamp: new Date().toISOString()
        };

        await redis.set(`b2b:referral:${id}`, JSON.stringify(referral));
        await redis.lpush(`agent:referrals:out:${referrerId}`, id);
        await redis.lpush(`agent:referrals:in:${refereeId}`, id);

        return referral;
    }

    /**
     * Accept a referral and split the standard fee.
     */
    async acceptReferral(referralId: string): Promise<boolean> {
        const data = await redis.get(`b2b:referral:${referralId}`);
        if (!data) return false;

        const referral: Referral = JSON.parse(data);
        if (referral.status !== 'PENDING') return false;

        console.log(`[ReferralService] ✅ Referral ${referralId} ACCEPTED by ${referral.refereeAgentId}`);

        referral.status = 'ACCEPTED';
        await redis.set(`b2b:referral:${referralId}`, JSON.stringify(referral));

        // Automatic Financial Settlement
        await solanaEconomyService.splitRevenue(
            referral.refereeAgentId, 
            referral.referralFee, 
            referral.referrerAgentId
        );

        return true;
    }

    async getReferralsForAgent(agentId: string, type: 'in' | 'out'): Promise<Referral[]> {
        const ids = await redis.lrange(`agent:referrals:${type}:${agentId}`, 0, -1);
        const results = await Promise.all(ids.map(async (id: string) => {
            const data = await redis.get(`b2b:referral:${id}`);
            return data ? JSON.parse(data) : null;
        }));
        return results.filter(r => r !== null);
    }
}

export const referralService = new ReferralService();
