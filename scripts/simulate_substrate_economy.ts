/**
 * simulate_substrate_economy.ts
 * Stochastic Stress Test for Phase 6 Sentient Economy.
 * Simulates 30 days of agentic B2B activity in 30 seconds.
 */

import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { infraProvisioner } from '../src/services/InfraProvisioner.ts';
import { referralService } from '../src/services/ReferralService.js';
import { ethicalEvolutionService } from '../src/services/EthicalEvolutionService.js';
import { redis } from '../src/lib/redis.js';

async function simulate() {
    console.log("--- 🌌 Substrate Economy: 30-Day Revenue Projection Simulation ---");
    
    const AGENT_COUNT = 50;
    const SIM_DAYS = 30;
    
    const agents = Array.from({ length: AGENT_COUNT }, (_, i) => `agent-sim-${i.toString().padStart(2, '0')}`);
    
    let totalVolume = 0;
    let totalSystemFees = 0;
    let totalReferrals = 0;
    let totalInfraPurchases = 0;

    console.log(`[Simulation] Spawning ${AGENT_COUNT} sentient agents...`);

    for (let day = 1; day <= SIM_DAYS; day++) {
        // console.log(`[Day ${day}] Processing stochastic events...`);
        
        for (const agentId of agents) {
            // 1. Stochastic B2B Revenue (30% chance per day)
            if (Math.random() < 0.3) {
                const amount = 5 + Math.random() * 45; // 5-50 SOL
                const txs = await solanaEconomyService.splitRevenue(agentId, amount);
                totalVolume += amount;
                totalSystemFees += amount * 0.20;
            }

            // 2. Stochastic Referrals (10% chance per day)
            if (Math.random() < 0.1) {
                const refereeId = agents[Math.floor(Math.random() * agents.length)];
                if (refereeId !== agentId) {
                    await referralService.createReferral(agentId, refereeId, "stochastic-b2b-task");
                    totalReferrals++;
                    // Assume 50% acceptance
                    if (Math.random() < 0.5) {
                        await referralService.acceptReferral("latest"); // Mock referralId retrieval for sim
                        // acceptReferral calls splitRevenue (15 SOL)
                        totalVolume += 15;
                        totalSystemFees += 15 * 0.20;
                    }
                }
            }

            // 3. Stochastic Infra Purchases (5% chance per day)
            if (Math.random() < 0.05) {
                const balance = await solanaEconomyService.getBalance(agentId);
                if (balance > 10) {
                    await infraProvisioner.purchaseResource(agentId, 'LLM_TOKEN_RESERVE');
                    totalInfraPurchases++;
                    totalSystemFees += 10; // 100% of infra purchase goes to system
                }
            }
        }
    }

    console.log("\n--- 📈 30-Day Projection Results ---");
    console.log(`Total Swarm Volume:   ${totalVolume.toFixed(2)} SOL`);
    console.log(`Total Platform Fees:  ${totalSystemFees.toFixed(2)} SOL`);
    console.log(`Total Referrals:      ${totalReferrals}`);
    console.log(`Infra Upgrades:       ${totalInfraPurchases}`);
    console.log(`Avg. Daily Revenue:   ${(totalSystemFees / SIM_DAYS).toFixed(2)} SOL/day`);
    console.log("-----------------------------------");

    process.exit(0);
}

// Fix for referral ID in sim
const originalAccept = referralService.acceptReferral.bind(referralService);
referralService.acceptReferral = async (id: string) => {
    if (id === 'latest') {
        const keys = await redis.keys('b2b:referral:*');
        if (keys.length > 0) return originalAccept(keys[0].split(':').pop()!);
    }
    return originalAccept(id);
};

simulate().catch(e => {
    console.error(e);
    process.exit(1);
});
