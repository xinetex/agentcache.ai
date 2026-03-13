/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * IdentityEquivalenceService: Ensures identity persistence across platforms.
 * Phase 6: The Sentience Layer.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';
import { aptEngine } from './APTEngine.js';
import { soulRegistry } from './SoulRegistry.js';
import { ethicalEvolutionService } from './EthicalEvolutionService.js';

export interface IdentityPassport {
    agentId: string;
    compositeId: string; // The "Unified Soul Hash"
    axiomCount: number;
    aptSignature: string;
    lastMarkerRoot: string;
    timestamp: string;
}

export class IdentityEquivalenceService {
    /**
     * Generate a cryptographic "Identity Passport" for an agent.
     * This bundle proves that the entity is the same across platforms.
     */
    async generatePassport(agentId: string): Promise<IdentityPassport | null> {
        console.log(`[IdentityEquivalence] 🛂 Generating Passport for agent ${agentId}...`);

        const apt = await aptEngine.getSignature(agentId);
        if (!apt) {
            console.warn(`[IdentityEquivalence] ❌ Agent ${agentId} lacks APT-Signature. Passport denied.`);
            return null;
        }

        const axioms = await ethicalEvolutionService.getAxioms(agentId);
        const committedAxioms = axioms.filter(a => a.governanceStatus === 'COMMITTED');
        const markers = await soulRegistry.getLedgerForAgent(agentId);
        const lastMarker = markers[markers.length - 1];

        const soulData = JSON.stringify({
            agentId,
            apt,
            axiomHashes: committedAxioms.map(a => a.id),
            lastMarkerRoot: lastMarker?.merkleRoot
        });

        const compositeId = createHash('sha256').update(soulData).digest('hex');

        const passport: IdentityPassport = {
            agentId,
            compositeId,
            axiomCount: committedAxioms.length,
            aptSignature: apt,
            lastMarkerRoot: lastMarker?.merkleRoot || 'NONE',
            timestamp: new Date().toISOString()
        };

        await redis.set(`soul:passport:${agentId}`, JSON.stringify(passport));
        
        console.log(`[IdentityEquivalence] ✅ Passport Minted: ${compositeId.substring(0, 16)}...`);
        return passport;
    }

    /**
     * Verify if a presented passport matches the registered state.
     */
    async verifyEquivalence(agentId: string, passport: IdentityPassport): Promise<boolean> {
        const storedData = await redis.get(`soul:passport:${agentId}`);
        if (!storedData) return false;

        const storedPassport: IdentityPassport = JSON.parse(storedData);
        
        // Strict equivalence check
        const isEquivalent = (
            storedPassport.compositeId === passport.compositeId &&
            storedPassport.aptSignature === passport.aptSignature
        );

        if (isEquivalent) {
            console.log(`[IdentityEquivalence] 💎 Match Confirmed: Agent ${agentId} is mathematically equivalent.`);
        } else {
            console.warn(`[IdentityEquivalence] ⚠️ Identity Drift: Passport for ${agentId} does not match.`);
        }

        return isEquivalent;
    }
}

export const identityEquivalenceService = new IdentityEquivalenceService();
