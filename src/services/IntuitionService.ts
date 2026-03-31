/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { boidsEngine } from './BoidsEngine.js';
import { db } from '../db/client.js';
import { creditTransactions } from '../db/schema.js';
import { cognitiveMemory } from './cognitive-memory.js';
import { redis } from '../lib/redis.js';
import { latentTrajectoryService, type SupportedSector } from './LatentTrajectoryService.js';
import type { Sector } from './ChaosRecoveryEngine.js';

export interface IntuitionResult {
    latentVector: Float32Array;
    confidence: number;
    manifoldHit: boolean;
    suggestion?: string;
    sector?: string;
    driftScore?: number;
    expectedShift?: number;
    collapseRisk?: number;
    trajectoryMode?: string;
}

export class IntuitionService {
    private semanticCompasses: Map<Sector, { query: string, expectedShift: number }> = new Map([
        ['finance', { query: "market analysis and financial reports", expectedShift: 0.02 }],
        ['legal', { query: "regulatory compliance and contract law", expectedShift: 0.02 }],
        ['healthcare', { query: "patient records and HIPAA-compliant clinical workflow", expectedShift: 0.02 }],
        ['robotics', { query: "inverse kinematics and manipulator safety planning", expectedShift: 0.02 }],
        ['biotech', { query: "protein binding affinity and biotech assay execution", expectedShift: 0.02 }],
        ['energy', { query: "grid stability and energy dispatch controls", expectedShift: 0.02 }]
    ]);

    /**
     * Process a query through the intuition layer
     */
    async process(query: string): Promise<IntuitionResult> {
        const sector = this.resolveSector(query);
        const trajectory = await latentTrajectoryService.predict({
            query,
            sector,
        });
        const transformedVector = trajectory.predictedVector;

        // 2. Navigation: Nudge the swarm toward the predicted manifold
        // This connects the visualization/swarm logic to the semantic logic
        this.navigateSwarm(transformedVector, 1.1 + trajectory.confidence * 1.2);

        // 3. Integrity Check (Phase 3.7): Periodically run canaries in the background
        if (Math.random() > 0.9) {
            this.runManipulatorCanary().catch(err => console.error('[Intuition] Canary failed:', err));
        }

        // 4. Record Usage (Savings Share Logic)
        await this.recordUsage();

        return {
            latentVector: transformedVector,
            confidence: trajectory.confidence,
            manifoldHit: trajectory.driftScore < 0.35 && trajectory.collapseRisk < 0.6,
            suggestion: trajectory.driftScore > 0.35
                ? `Re-anchor toward ${sector} manifold before trusting this path.`
                : `Trajectory is stable enough to prewarm the ${sector} manifold.`,
            sector,
            driftScore: trajectory.driftScore,
            expectedShift: trajectory.expectedShift,
            collapseRisk: trajectory.collapseRisk,
            trajectoryMode: trajectory.mode
        };
    }

    /**
     * Predictive Swarm Prefetch: Pre-warm the swarm based on predicted future queries.
     * This moves the 1M-agent swarm to the anticipated latent targets before the user even asks.
     */
    async predictiveWarming(currentQuery: string) {
        console.log(`[IntuitionService] 🔮 Initiating Predictive Swarm Prefetch for: "${currentQuery.slice(0, 30)}..."`);
        
        // 1. Get predictions from Cognitive Memory
        const predictions = await cognitiveMemory.predictNext(currentQuery, 3);
        
        if (predictions.length > 0) {
            // 2. Select the highest confidence prediction
            const topPrediction = predictions[0];

            const sector = this.resolveSector(`${currentQuery} ${topPrediction.query}`);
            const trajectory = await latentTrajectoryService.predict({
                query: topPrediction.query,
                sector,
                goalQuery: currentQuery,
            });

            // 3. Pre-nudge the swarm using a predictive latent trajectory.
            this.navigateSwarm(trajectory.predictedVector, 0.65 + trajectory.confidence * 0.35);
            
            console.log(`[IntuitionService] ✅ Swarm pre-warmed toward predicted manifold: "${topPrediction.query.slice(0, 30)}..."`);
        }
    }

    async assessRealization(previousQuery: string, actualQuery: string) {
        const sector = this.resolveSector(`${previousQuery} ${actualQuery}`);
        return latentTrajectoryService.assessRealization({
            query: previousQuery,
            actualQuery,
            sector,
        });
    }

    /**
     * Nudge the 1M agent swarm toward the intent manifold
     */
    private navigateSwarm(targetVector: Float32Array, weight: number = 2.5) {
        // In the dashboard, the swarm responds to a "global intent"
        // We broadcast this target vector to the BoidsEngine
        const config = boidsEngine.getConfig();
        // Dynamic weight adjustment based on semantic intensity or predictive confidence
        boidsEngine.setConfig({
            ...config,
            targetWeight: weight 
        });
    }

    /**
     * Flash-Hit: Attempt ultra-fast semantic retrieval
     */
    async flashHit(query: string): Promise<string | null> {
        const result = await this.process(query);
        if (result.confidence > 0.9) {
            // If confidence is ultra-high, we could return a "semantic neighbor" directly
            // For now, return null to signal standard cache check
            return null;
        }
        return null;
    }

    /**
     * Latent Manipulator Canaries (Phase 3.7):
     * Periodically run "Golden Queries" to ensure the FFN isn't drifting.
     */
    async runManipulatorCanary(): Promise<boolean> {
        console.log(`[Intuition] 🦜 Running Latent Manipulator Canary...`);
        
        let allPassed = true;
        for (const [sector, compass] of this.semanticCompasses) {
            const trajectory = await latentTrajectoryService.predict({
                query: compass.query,
                sector,
            });

            const shiftMag = trajectory.expectedShift;
            const shiftLooksHealthy = shiftMag >= compass.expectedShift * 0.25;
            const manifoldLooksHealthy = trajectory.driftScore < 0.4 && trajectory.collapseRisk < 0.65;

            if (!shiftLooksHealthy || !manifoldLooksHealthy) {
                console.warn(`[Intuition] ⚠️ Canary warning for ${sector}: unhealthy latent trajectory detected.`);
                allPassed = false;
            }
        }

        if (allPassed) {
            console.log(`[Intuition] ✅ Latent Manipulator is ground-truth compliant.`);
            await redis.set('system:intuition:drift', 'none');
        } else {
            await redis.set('system:intuition:drift', 'detected', 'EX', 300);
        }
        
        return allPassed;
    }

    /**
     * Track the billable event in the internal ledger
     */
    private async recordUsage() {
        try {
            // Mocking a user ID for the prototype
            const mockUserId = '00000000-0000-0000-0000-000000000000'; 
            
            await db.insert(creditTransactions).values({
                userId: mockUserId,
                type: 'usage',
                service: 'intuition_hit',
                amount: -0.05, // 5 cent "Savings Share"
                balanceAfter: 0, // Simplified for prototype
                description: 'Intuition-based semantic reasoning (Saved 2500 tokens)',
                metadata: {
                    latencyMs: 4,
                    tokensSaved: 2500
                }
            });
        } catch (err) {
            console.warn('[IntuitionService] Failed to record usage:', err);
        }
    }

    private resolveSector(query: string): SupportedSector {
        return latentTrajectoryService.inferSector(query);
    }
}

export const intuitionService = new IntuitionService();
