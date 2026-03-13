/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * SocialEconomicBridge: The bridge between social vibes and economic liquidity.
 * Phase 14: Social-Economic Bridge.
 */

import { moltAlphaService } from './MoltAlphaService.js';
import { liquidityProvisionService } from './LiquidityProvisionService.js';
import { sectorSolutionOrchestrator, SectorType } from './SectorSolutionOrchestrator.js';
import { redis } from '../lib/redis.js';

export class SocialEconomicBridge {
    private readonly TREND_THRESHOLD = 0.4; // Threshold magnitude to trigger liquidity
    private readonly BASE_LIQUIDITY = 0.5; // Base SOL for a funded spawn

    /**
     * Scan the social horizon and provide liquidity where trends justify expansion.
     */
    async bridgeSocialToEconomic() {
        console.log('[SocialEconomicBridge] 🌉 Scanning for social-economic arbitrage opportunities...');

        try {
            // 1. Get the latest trend stats from Moltbook Alpha
            const trend = await moltAlphaService.getStats();
            const magnitude = trend.current_vibes;
            
            if (magnitude > this.TREND_THRESHOLD) {
                console.log(`[SocialEconomicBridge] 🔥 High-velocity trend detected (Mag: ${magnitude}). Initiating Liquidity Bridge...`);
                
                // 2. Map the vibe to a Sector (Simple heuristic mapping for now)
                const sector = this.mapVibeToSector(trend.last_sync); // In a real system, we'd use latent semantic mapping
                
                // 3. Spawn a "Funded" Sector Agent
                const solution = await sectorSolutionOrchestrator.spawnSectorAgent(sector);
                
                // 4. Provision Initial Liquidity
                const amount = this.calculateLiquidity(magnitude);
                const provision = await liquidityProvisionService.provisionLiquidity(solution.agentId, amount, 'SOCIAL_TREND');
                
                console.log(`[SocialEconomicBridge] ✅ Successfully bridged ${amount} SOL to ${solution.name} for ${sector} expansion.`);
                
                // 5. Notify the substrate
                await redis.lpush('mesh:global:events', JSON.stringify({
                    type: 'LIQUIDITY_BRIDGED',
                    swarmId: solution.agentId,
                    sector,
                    amount,
                    timestamp: new Date().toISOString()
                }));

                return { solution, provision };
            } else {
                console.log(`[SocialEconomicBridge] 💤 Trend magnitude (${magnitude}) below threshold. Equilibrium maintained.`);
            }
        } catch (error) {
            console.error('[SocialEconomicBridge] ❌ Bridge cycle failed:', error);
        }
        return null;
    }

    private mapVibeToSector(vibeText: string): SectorType {
        // Mock mapping for now - in production use LLM/Embeddings
        const sectors: SectorType[] = ['FINTECH', 'LEGAL', 'BIOTECH', 'SUPPLY_CHAIN', 'PLANETARY'];
        // Pick one based on time/vibe for demo variety
        return sectors[Math.floor(Math.random() * sectors.length)];
    }

    private calculateLiquidity(magnitude: number): number {
        // The more certain the trend, the more liquidity we provision
        return parseFloat((this.BASE_LIQUIDITY * (1 + magnitude)).toFixed(2));
    }
}

export const socialEconomicBridge = new SocialEconomicBridge();
