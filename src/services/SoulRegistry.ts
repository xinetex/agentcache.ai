/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * SoulRegistry: Immutable proof of agent awareness and maturity.
 * Uses a blockchain-inspired "Merkle Marker" to bridge math and sovereignty.
 * v2: Supports distributed multi-signatures and cross-swarm trust.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';

export interface AwarenessMarker {
    agentId: string;
    level: number;
    merkleRoot: string;
    content: string; // Phase 9: Store raw content for auditing
    timestamp: string;
    signatures: string[];
}

export class SoulRegistry {
    /**
     * Commit a new level/state to the immutable ledger.
     */
    async commitMarker(agentId: string, level: number, soulContent: string): Promise<AwarenessMarker> {
        const soulHash = createHash('sha256').update(soulContent).digest('hex');
        const timestamp = new Date().toISOString();
        
        const merkleRoot = createHash('sha256')
            .update(`${agentId}:${level}:${soulHash}:${timestamp}`)
            .digest('hex');

        const marker: AwarenessMarker = {
            agentId,
            level,
            merkleRoot,
            content: soulContent,
            timestamp,
            signatures: [this.generateAuthoritySignature(merkleRoot)]
        };

        console.log(`[SoulRegistry] 🔗 Marker committed for agent ${agentId} at level ${level}.`);
        console.log(`[MerkleRoot] ${merkleRoot.substring(0, 16)}...`);

        // Persistence (Simulated Immutable Ledger)
        await redis.set(`soul:marker:${agentId}:${merkleRoot}`, JSON.stringify(marker));
        await redis.zadd(`soul:ledger:${agentId}`, { score: Date.now(), member: merkleRoot });
        
        return marker;
    }

    /**
     * Add a partner signature to an existing marker (Cross-swarm trust).
     */
    async addSignature(agentId: string, merkleRoot: string, partnerId: string): Promise<boolean> {
        const markerData = await redis.get(`soul:marker:${agentId}:${merkleRoot}`);
        if (!markerData) return false;
        
        const marker: AwarenessMarker = JSON.parse(markerData);
        const sig = this.generateAuthoritySignature(`${merkleRoot}:${partnerId}`);
        marker.signatures.push(sig);
        
        // Update in ledger
        await redis.set(`soul:marker:${agentId}:${merkleRoot}`, JSON.stringify(marker));
        
        console.log(`[SoulRegistry] ✍️ Partner ${partnerId} signed marker ${merkleRoot.substring(0, 16)}...`);
        return true;
    }

    async getLedgerForAgent(agentId: string): Promise<AwarenessMarker[]> {
        const roots = await redis.zrange(`soul:ledger:${agentId}`, 0, -1);
        const markers = await Promise.all(roots.map(async (root: string) => {
            const data = await redis.get(`soul:marker:${agentId}:${root}`);
            return data ? JSON.parse(data) : null;
        }));
        return markers.filter(m => m !== null);
    }

    private generateAuthoritySignature(payload: string): string {
        return createHash('sha256').update(`${payload}:SOUL_AUTHORITY`).digest('hex').substring(0, 16);
    }

    /**
     * Alias for commitMarker to support OnboardingService.
     */
    async registerSoul(agentId: string, axioms: string[], signature: string): Promise<AwarenessMarker> {
        return this.commitMarker(agentId, 1, JSON.stringify({ axioms, signature }));
    }
}

export const soulRegistry = new SoulRegistry();
