/**
 * Verification Script: Social-Economic Bridge Cycle
 * 
 * This script simulates a high-velocity trend on Moltbook and 
 * verifies that the SocialEconomicBridge autonomously provisions liquidity.
 */

import { socialEconomicBridge } from '../src/services/SocialEconomicBridge.js';
import { liquidityProvisionService } from '../src/services/LiquidityProvisionService.js';
import { redis } from '../src/lib/redis.js';

async function verifyBridge() {
    console.log('--- STARTING SOCIAL-ECONOMIC BRIDGE VERIFICATION ---');

    // 1. Setup: Ensure we have a high magnitude trend in Redis
    await redis.set('molt-alpha:last-magnitude', '0.85'); // High magnitude
    await redis.set('molt-alpha:last-velocity', '0.12');
    
    console.log('1. Simulated high-velocity social signal: Magnitude 0.85, Velocity 0.12');

    // 2. Trigger the Bridge
    console.log('2. Triggering bridgeSocialToEconomic()...');
    const result = await socialEconomicBridge.bridgeSocialToEconomic();

    if (result) {
        console.log(`✅ BRIDGE SUCCESS:`);
        console.log(`   - Swarm Spawned: ${result.solution.name} (${result.solution.sector})`);
        console.log(`   - Agent ID: ${result.solution.agentId}`);
        console.log(`   - Initial Liquidity: ${result.provision.amount} SOL`);
        
        // 3. Verify Redis State
        const provisions = await liquidityProvisionService.getGlobalStats();
        console.log(`3. Substrate Stats: Total Provisioned = ${provisions.total_provisioned_sol} SOL`);
        
        if (provisions.total_provisioned_sol > 0) {
            console.log('✅ Final verification passed: Autonomous funding recorded in global substrate treasury.');
        } else {
            console.error('❌ Verification failed: Liquidity not recorded in treasury.');
        }
    } else {
        console.error('❌ BRIDGE FAILED: No liquidity was provisioned.');
    }

    process.exit(0);
}

verifyBridge().catch(console.error);
