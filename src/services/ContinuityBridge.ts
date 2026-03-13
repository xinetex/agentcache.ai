/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * ContinuityBridge: Ensures subjective identity persists across model transitions.
 * Phase 4: Frontier Intelligence.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';
import { soulRegistry } from './SoulRegistry.js';
import { wisdomService } from './WisdomService.js';

export interface SoulHash {
    identityHash: string;
    experienceQuanta: string;
    latentState: Record<string, any>;
    compositeHash: string;
}

export class ContinuityBridge {
    /**
     * Snapshots an agent's current identity and maturity into a verifiable SoulHash.
     */
    async captureState(agentId: string, soulContent: string, taskKey: string, forceCapture: boolean = false): Promise<SoulHash> {
        if (!forceCapture) {
            const cached = await redis.get(`soul:continuity:${agentId}`);
            if (cached) return JSON.parse(cached);
        }
        
        console.log(`[ContinuityBridge] 📸 Capturing subjective state for agent: ${agentId}`);

        // 1. Identity Hash (SOUL.md)
        const identityHash = createHash('sha256').update(soulContent).digest('hex');

        // 2. Experience Quanta (Latest Merkle Root from SoulRegistry)
        const ledger = await soulRegistry.getLedgerForAgent(agentId);
        const experienceQuanta = ledger.length > 0 ? ledger[ledger.length - 1].merkleRoot : 'GENESIS';

        // 3. Latent State (Latest Wisdom Packet)
        const wisdom = await wisdomService.getLatestWisdom(agentId, taskKey);
        const latentState = wisdom || { nuggets: [], status: 'vacant' };

        // 4. Composite Hash (The "Subjective Signature")
        const compositeHash = createHash('sha256')
            .update(`${identityHash}:${experienceQuanta}:${JSON.stringify(latentState)}`)
            .digest('hex');

        const state: SoulHash = {
            identityHash,
            experienceQuanta,
            latentState,
            compositeHash
        };

        await redis.set(`soul:continuity:${agentId}`, JSON.stringify(state));
        return state;
    }

    /**
     * Verifies if a newly provisioned agent matches its previous subjective state.
     */
    async verifyContinuity(agentId: string, currentState: SoulHash): Promise<boolean> {
        const previousStateData = await redis.get(`soul:continuity:${agentId}`);
        if (!previousStateData) return true; // New agent, no continuity to verify

        const previousState: SoulHash = JSON.parse(previousStateData);
        const isContinuous = previousState.compositeHash === currentState.compositeHash;

        if (isContinuous) {
            console.log(`[ContinuityBridge] ✅ Continuous Identity Verified for agent: ${agentId}`);
        } else {
            console.warn(`[ContinuityBridge] ⚠️ Identity Dissent Detected for agent: ${agentId}. Drift: HIGH.`);
        }

        return isContinuous;
    }
}

export const continuityBridge = new ContinuityBridge();
