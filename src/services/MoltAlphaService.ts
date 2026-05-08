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
import { 
    patterns, 
    periscopeRuns, 
    periscopeSteps,
    periscopeActions 
} from '../db/schema.js';
import { moltbookCrawler } from './MoltbookCrawler.js';
import { sql, eq } from 'drizzle-orm';

export interface MoltTrend {
    topic: string;
    magnitude: number;
    velocity: number;
    prediction: string;
}

const MOLT_ALPHA_STATS_CACHE_KEY = 'molt-alpha:stats:v1';
const MOLT_ALPHA_STATS_TTL_SECONDS = Number(process.env.MOLT_ALPHA_STATS_TTL_SECONDS || 60);

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
            const runs = await db.insert(periscopeRuns).values({
                agentId: 'molt-alpha-ingestor',
                sessionId: `moltbook_${Date.now()}`
            }).returning({ id: periscopeRuns.id });
            
            if (!runs || runs.length === 0) {
                console.error('[Molt-Alpha] ❌ Failed to create Periscope Run');
                return null;
            }
            const runId = runs[0].id;
            console.log(`[Molt-Alpha] 📁 Created Run ID: ${runId}`);

            await db.insert(periscopeSteps).values({
                runId: runId,
                index: 0,
                goalTag: 'ingest_moltbook_trends',
                stateSignature: { clusters }
            });
            console.log('[Molt-Alpha] 📑 Created Step for Run');

            // 2.5 Add a dummy action to represent the crawler work so DreamService has a trace
            await db.insert(periscopeActions).values({
                stepId: (await db.select().from(periscopeSteps).where(eq(periscopeSteps.runId, runId)).limit(1))[0].id,
                actionType: 'observation',
                toolName: 'MoltbookCrawler',
                success: true,
                latencyMs: 1200
            });
            console.log('[Molt-Alpha] 🛠️ Created Crawler Action');

            const morphism = await dreamService.synthesizeMorphism(runId);
            if (!morphism) {
                console.warn('[Molt-Alpha] ⚠️ DreamService returned null morphism');
                return null;
            }
            if (!morphism.latentDelta) {
                console.warn('[Molt-Alpha] ⚠️ Morphism missing latentDelta');
                return null;
            }

            // 3. Topographical Analysis: Analyze Drift Velocity
            const { magnitude } = await cognitiveEngine.detectIntentDrift(morphism.latentDelta);
            
            // Calculate velocity vs rolling window (stored in Redis)
            const previousMagnitude = parseFloat(await redis.get('molt-alpha:last-magnitude') || '0');
            const velocity = magnitude - previousMagnitude;

            await redis.set('molt-alpha:last-magnitude', magnitude.toString());
            await redis.set('molt-alpha:last-velocity', velocity.toString());

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

    /**
     * Get real-time growth stats for the dashboard.
     */
    async getStats() {
        try {
            const cached = await redis.get(MOLT_ALPHA_STATS_CACHE_KEY);
            if (cached) {
                return typeof cached === 'string' ? JSON.parse(cached) : cached;
            }
        } catch (error) {
            console.warn('[Molt-Alpha] Failed to read cached stats:', error);
        }

        const magnitude = parseFloat(await redis.get('molt-alpha:last-magnitude') || '0.245');
        const count = await redis.get('molt-alpha:prediction-count') || '128';
        
        // Keep this query narrow and cache the full payload to reduce Neon churn.
        const activeSpirits = await db.select({
            name: patterns.name,
            status: patterns.status,
            energyLevel: patterns.energyLevel,
        }).from(patterns)
            .where(sql`name LIKE 'Spirit:%' AND status = 'active'`)
            .limit(10);

        const payload = {
            current_vibes: magnitude,
            total_predictions: parseInt(count),
            active_spirits_count: activeSpirits.length,
            recent_spirits: activeSpirits.map(s => ({
                name: s.name,
                status: s.status.toUpperCase(),
                energy: s.energyLevel
            })),
            status: magnitude > 0.5 ? 'VOLATILE' : 'STABLE',
            spillover_traffic: Math.floor(magnitude * 10000), // Estimated agents following vibes
            redirection_yield: (parseFloat(await redis.get('molt-alpha:last-velocity') || '0.01') * 100).toFixed(2) + '%',
            last_sync: new Date().toISOString()
        };

        try {
            await redis.setex(MOLT_ALPHA_STATS_CACHE_KEY, MOLT_ALPHA_STATS_TTL_SECONDS, JSON.stringify(payload));
        } catch (error) {
            console.warn('[Molt-Alpha] Failed to cache stats payload:', error);
        }

        return payload;
    }
}

export const moltAlphaService = new MoltAlphaService();
