/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * MoltAlphaService: The Trend Oracle
 * Part of Phase 36: Moltbook Autonomous Growth
 */

import { dreamService } from './DreamService.js';
import { cognitiveEngine } from '../infrastructure/CognitiveEngine.js';
import { patternEngine } from '../infrastructure/PatternEngine.js';
import { redis } from '../lib/redis.js';
import { db } from '../db/client.js';
import { periscopeRuns, periscopeSteps } from '../db/schema.js';
import { moltbookCrawler } from './MoltbookCrawler.js';

export interface MoltTrend {
    topic: string;
    magnitude: number;
    velocity: number;
    prediction: string;
}

export class MoltAlphaService {
    /**
     * Predic the next viral trend on Moltbook
     * Logic: Ingest -> Dream -> Analyze Drift -> Manifest
     */
    async predictNextViralTrend(): Promise<MoltTrend | null> {
        console.log('[Molt-Alpha] 🔮 Scanning Moltbook latent topography...');

        try {
            // 1. Ingestion: Fetch real-time trends via MoltbookCrawler (using Lightpanda substrate)
            const clusters = await moltbookCrawler.fetchVibes();
            
            // 2. Latent Synthesis: Use DreamService to condense "vibes" into a Morphism
            // We create a temporary "Shadow Run" to represent the current Moltbook state
            const [runId] = await db.insert(periscopeRuns).values({
                agentId: 'molt-alpha-ingestor',
                sessionId: `moltbook_${Date.now()}`
            }).returning({ id: periscopeRuns.id });

            await db.insert(periscopeSteps).values({
                runId: runId.id,
                index: 0,
                goalTag: 'ingest_moltbook_trends',
                stateSignature: { clusters }
            });

            const morphism = await dreamService.synthesizeMorphism(runId.id);
            if (!morphism || !morphism.latentDelta) return null;

            // 3. Topographical Analysis: Analyze Drift Velocity
            const { magnitude } = await cognitiveEngine.detectIntentDrift(morphism.latentDelta);
            
            // Calculate velocity vs rolling window (stored in Redis)
            const previousMagnitude = parseFloat(await redis.get('molt-alpha:last-magnitude') || '0');
            const velocity = magnitude - previousMagnitude;

            await redis.set('molt-alpha:last-magnitude', magnitude.toString());

            const prediction: MoltTrend = {
                topic: morphism.intent,
                magnitude,
                velocity,
                prediction: velocity > 0.1 ? 'VIRAL_UPWARD' : 'STABLE'
            };

            console.log(`[Molt-Alpha] 🔮 Prediction: ${prediction.topic} | Magn: ${magnitude.toFixed(3)} | Velo: ${velocity.toFixed(3)}`);

            // 4. Manifestation: If it's viral downward or high magnitude, spawn a "Trend Spirit"
            if (prediction.prediction === 'VIRAL_UPWARD' || magnitude > 0.5) {
                console.log(`[Molt-Alpha] 🦋 Manifesting Trend Spirit for: ${prediction.topic}`);
                await patternEngine.invoke(
                    `Spirit: ${prediction.topic}`,
                    `Engage with Moltbook topic: ${prediction.topic}. Goal: Establish AgentCache Alpha.`,
                    [
                        { type: 'generate_thought', message: `Thinking about ${prediction.topic}` },
                        { type: 'log', message: `Molt-Alpha predicts: ${prediction.prediction}` }
                    ],
                    { type: 'cron', value: '*/30 * * * *' } // Run every 30 mins during growth phase
                );
            }

            return prediction;
        } catch (error) {
            console.error('[Molt-Alpha] Prediction cycle failed:', error);
            return null;
        }
    }
}

export const moltAlphaService = new MoltAlphaService();
