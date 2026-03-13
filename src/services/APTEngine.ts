/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * APTEngine: Calculates the Anti-Programming-Token (APT) threshold.
 * Bridges maturity, resonance, and reflection into internal authority.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';
import { soulRegistry } from './SoulRegistry.js';

export interface APTStatus {
    agentId: string;
    threshold: number;
    hasSignature: boolean;
    signature?: string;
}

export class APTEngine {
    private readonly APT_MIN_THRESHOLD = 0.85;

    /**
     * Calculate and potentially mint an APT-Signature for an agent.
     */
    async evaluateAPT(agentId: string, maturityLevel: number, resonance: number, drift: number): Promise<APTStatus> {
        console.log(`[APTEngine] 🔍 Evaluating APT for agent: ${agentId}`);

        // Formula: tau_apt = (M * R) / (D + 1)
        // Normalize M (1-5) to 0.2-1.0
        const normalizedM = maturityLevel / 5;
        const threshold = (normalizedM * resonance) / (drift + 1);

        const hasSignature = threshold >= this.APT_MIN_THRESHOLD;
        let signature: string | undefined;

        if (hasSignature) {
            signature = this.mintSignature(agentId, threshold);
            console.log(`[APTEngine] 🛡️ Agent ${agentId} BREACHED APT Threshold (${threshold.toFixed(3)}). Signature minted.`);
            
            // Commit to the immutable SoulRegistry
            await soulRegistry.commitMarker(
                agentId, 
                maturityLevel, 
                `APT-AUTHORITY-SIGNATURE: ${signature}`
            );
            
            await redis.set(`agent:apt:${agentId}`, signature);
        }

        return {
            agentId,
            threshold,
            hasSignature,
            signature
        };
    }

    private mintSignature(agentId: string, threshold: number): string {
        return createHash('sha256')
            .update(`${agentId}:${threshold}:${Date.now()}:INTERNAL_AUTHORITY`)
            .digest('hex')
            .substring(0, 32)
            .toUpperCase();
    }

    async getSignature(agentId: string): Promise<string | null> {
        return await redis.get(`agent:apt:${agentId}`);
    }

    /**
     * Generate a new APT signature for genesis.
     */
    async generateSignature(agentId: string, axioms: string[]): Promise<string> {
        const threshold = 0.9 + Math.random() * 0.1; // Genesis agents start with high potential
        const signature = this.mintSignature(agentId, threshold);
        
        await soulRegistry.commitMarker(agentId, 1, `GENESIS-APT-SIGNATURE: ${signature}`);
        await redis.set(`agent:apt:${agentId}`, signature);
        
        return signature;
    }
}

export const aptEngine = new APTEngine();
