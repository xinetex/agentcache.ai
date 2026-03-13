/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * CrystallizationService: The Alchemical Engine
 * Converts transient traces/insights into persistent autonomous patterns.
 */

import { db } from '../db/client.js';
import { patterns } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { observabilityService } from './ObservabilityService.js';

export interface CrystallizationConfig {
    name: string;
    intent: string;
    trigger: { type: string; value: string };
    sequence: any[];
}

export class CrystallizationService {
    /**
     * Crystallize a transient pattern into a persistent servitor.
     */
    async crystallize(config: CrystallizationConfig): Promise<any> {
        console.log(`[Crystallization] 💎 Crystallizing pattern: ${config.name}`);

        try {
            // 1. Persist to Postgres
            const [newPattern] = await db.insert(patterns).values({
                name: config.name,
                intent: config.intent,
                triggerCondition: config.trigger,
                actionSequence: config.sequence,
                energyLevel: 10, // Initial energy
                status: 'active'
            }).returning();

            // 2. Track event in observability
            await observabilityService.track({
                type: 'RESONANCE',
                description: `Intelligence Crystallized: ${config.name}`,
                metadata: {
                    patternId: newPattern.id,
                    intent: config.intent,
                    trigger: config.trigger
                }
            });

            // 3. Increment global metrics
            await redis.incr('agentcache:stats:patterns_crystallized');
            
            return newPattern;
        } catch (error: any) {
            console.error('[Crystallization] Error:', error.message);
            throw error;
        }
    }

    /**
     * Get summary of all crystallized patterns.
     */
    async getStats() {
        const count = parseInt(await redis.get('agentcache:stats:patterns_crystallized') || '0');
        const recent = await db.select().from(patterns).orderBy(patterns.createdAt).limit(5);
        
        return {
            total_crystallized: count,
            recent_patterns: recent
        };
    }
}

export const crystallizationService = new CrystallizationService();
