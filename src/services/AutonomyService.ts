/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { platformReportService } from './PlatformReportService.js';
import { swarmService } from './SwarmService.js';
import { cortexBridge } from './CortexBridge.js';
import { invalidationService } from './InvalidationService.js';
import { internalEconomics } from './InternalEconomicsService.js';
import { redis } from '../lib/redis.js';

/**
 * AutonomyService: The proactive "Brain" of the platform.
 * It monitors sector health and autonomously spawns swarms to optimize sectors in need.
 */
export class AutonomyService {
    private interval: NodeJS.Timeout | null = null;
    private isRunning = false;

    /**
     * Start the autonomy loop.
     */
    start(intervalMs = 600000) { // Default 10 mins
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🧠 [AutonomyService] Initializing proactive monitoring loop...');
        
        this.interval = setInterval(() => this.tick(), intervalMs);
        // Run first tick immediately
        this.tick();
    }

    /**
     * Stop the autonomy loop.
     */
    stop() {
        if (this.interval) clearInterval(this.interval);
        this.isRunning = false;
        console.log('🧠 [AutonomyService] Monitoring loop suspended.');
    }

    /**
     * Single observation/action cycle.
     */
    async tick() {
        const start = Date.now();
        console.log('🧠 [AutonomyService] Observing sector health and maintenance cues...');
        
        // Safety Check: Are we burning too much Vercel/Redis cash?
        if (await internalEconomics.shouldThrottle()) {
            console.log("🧠 [AutonomyService] Throttling tick due to platform budget limit.");
            return;
        }

        try {
            // Phase 4.2: Trigger Active Maintenance (Invalidation Swarm)
            await invalidationService.runMaintenanceStep();

            const pockets = await platformReportService.detectNeedPockets();
            
            if (pockets.length === 0) {
                console.log('🧠 [AutonomyService] All sectors balanced. No intervention required.');
                return;
            }

            for (const pocket of pockets) {
                // Prevent duplicate spawning for the same pocket in a short window
                const lockKey = `autonomy:spawn_lock:${pocket.sectorId}`;
                const locked = await redis.get(lockKey);
                
                if (locked) {
                    console.log(`🧠 [AutonomyService] Skipping ${pocket.name} (locked/already active).`);
                    continue;
                }

                console.log(`🧠 [AutonomyService] SEVERE NEED DETECTED in ${pocket.name}. Spawning optimization swarm...`);
                
                // 1. Log to the centralized intelligence layer (Cortex)
                await cortexBridge.synapse({
                    sector: pocket.sectorId.toUpperCase() as any,
                    type: 'OPTIMIZATION_REQUIRED',
                    message: `Autonomous intervention triggered for ${pocket.name}: ${pocket.reason}`
                });

                // 2. Trigger Swarm Spawn
                await swarmService.spawnSwarm({
                    goal: `Optimize cache performance and ontology mapping for the ${pocket.name} sector. Reduce misses and improve semantic accuracy.`,
                    participants: [
                        { role: 'researcher', count: Math.ceil(pocket.recommendedSwarmSize / 2) },
                        { role: 'optimizer', count: Math.floor(pocket.recommendedSwarmSize / 2) || 1 }
                    ],
                    priority: pocket.severity === 'high' ? 1 : 2
                });

                // 3. Lock this sector for 1 hour to allow the swarm to work
                await redis.set(lockKey, 'active', 'EX', 3600);
            }
        } catch (error: any) {
            console.error('🧠 [AutonomyService] Error in tick:', error.message);
        } finally {
            const executionMs = Date.now() - start;
            // Record overhead: execution time + rough estimate of Redis ops performed
            await internalEconomics.recordOverhead(executionMs, 5); 
        }
    }
}

export const autonomyService = new AutonomyService();
