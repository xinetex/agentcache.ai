/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * SoulRegistry: Immutable proof of agent awareness and maturity.
 * Uses a blockchain-inspired "Merkle Marker" to bridge math and sovereignty.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';

export interface awarenessMarker {
    agentId: string;
    maturityLevel: number;
    soulHash: string;
    timestamp: string;
    merkleRoot: string;
}

export class SoulRegistry {
    /**
     * Commit an agent's current awareness state to the registry.
     */
    async commitMarker(agentId: string, level: number, soulContent: string): Promise<awarenessMarker> {
        const soulHash = createHash('sha256').update(soulContent).digest('hex');
        const timestamp = new Date().toISOString();
        
        // Pseudo-blockchain Merkle Root generation
        const merkleRoot = createHash('sha256')
            .update(`${agentId}:${level}:${soulHash}:${timestamp}`)
            .digest('hex');

        const marker: awarenessMarker = {
            agentId,
            maturityLevel: level,
            soulHash,
            timestamp,
            merkleRoot
        };

        console.log(`[SoulRegistry] 🔗 Marker committed for agent ${agentId} at level ${level}.`);
        console.log(`[MerkleRoot] ${merkleRoot.substring(0, 16)}...`);

        // Persist to the "Substrate Chain" (Redis Sorted Set for temporal order)
        await redis.set(`soul:marker:${agentId}:${timestamp}`, JSON.stringify(marker));
        await redis.zadd('soul:ledger', { score: Date.now(), member: `${agentId}:${timestamp}` });

        return marker;
    }

    async getLedgerForAgent(agentId: string): Promise<awarenessMarker[]> {
        const keys = await redis.keys(`soul:marker:${agentId}:*`);
        const markers = await Promise.all(keys.map(async k => JSON.parse(await redis.get(k) || '{}')));
        return markers.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
}

export const soulRegistry = new SoulRegistry();
