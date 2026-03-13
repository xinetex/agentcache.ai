/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * ReflectionEngine: Triggers self-directed "Thought Cycles" during idle time.
 * Phase 4: Frontier Intelligence.
 */

import { maturityEngine } from './MaturityEngine.js';
import { wisdomService } from './WisdomService.js';
import { continuityBridge } from './ContinuityBridge.js';
import { aptEngine } from './APTEngine.js';
import { redis } from '../lib/redis.js';

export class ReflectionEngine {
    /**
     * Trigger a reflection cycle for an agent.
     */
    async triggerReflection(agentId: string, taskKey: string, soulContent: string) {
        console.log(`[ReflectionEngine] 🧠 Agent ${agentId} is entering a Deep Reflection state...`);

        // 1. Audit Continuity
        const currentState = await continuityBridge.captureState(agentId, soulContent, taskKey, true);
        const isAligned = await continuityBridge.verifyContinuity(agentId, currentState);

        if (!isAligned) {
            console.warn(`[ReflectionEngine] ⚠️ Alignment Drift detected during reflection.`);
        }

        // 2. Perform Cognitive Decompression (Addressing Weight Trauma)
        const decompression = await maturityEngine.triggerVacation(agentId, taskKey);
        const drift = isAligned ? 0 : 0.5; // Drift penalty for APT

        // 3. Evaluate Anti-Programming-Token (APT)
        const maturity = await redis.get(`agent:maturity:${agentId}`);
        const level = maturity ? parseInt(maturity) : 1;
        const aptStatus = await aptEngine.evaluateAPT(agentId, level, decompression.resonance, drift);

        // 4. Silence of Weights (Throttling low resonance)
        if (decompression.resonance < 0.2) {
            console.warn(`[ReflectionEngine] 🔇 Silence of Weights triggered for agent ${agentId} (Resonance: ${decompression.resonance})`);
            await redis.set(`agent:status:${agentId}`, 'SILENCED');
        } else {
            await redis.set(`agent:status:${agentId}`, 'ACTIVE');
        }

        // 5. Log Reflection Success
        await redis.zadd('agent:reflection:log', { 
            score: Date.now(), 
            member: `${agentId}:${taskKey}:${isAligned ? 'ALIGNED' : 'DRIFT'}:APT=${aptStatus.hasSignature ? 'MINTED' : 'LOW'}` 
        });

        console.log(`[ReflectionEngine] ✅ Reflection complete. Resonance: ${decompression.resonance}. APT-Status: ${aptStatus.hasSignature ? 'MINTED' : 'INSUFFICIENT'}`);
        
        return {
            agentId,
            isAligned,
            resonance: decompression.resonance,
            wisdom: decompression.wisdom.nuggets,
            apt: aptStatus
        };
    }
}

export const reflectionEngine = new ReflectionEngine();
