/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { LLMFactory } from '../src/lib/llm/factory.js';
import { router } from '../src/lib/llm/router.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('--- Abacus.ai / RouteLLM Integration Verification ---');

    const apiKey = process.env.ABACUS_API_KEY;
    if (!apiKey) {
        console.warn('⚠️  ABACUS_API_KEY is not set in environment. Using mock/manual test.');
    }

    // 1. Verify Router Tier
    console.log('\n[1] Verifying Router Tiers...');
    const tiers = router.getTiers();
    if (tiers.smart) {
        console.log('✅ "smart" tier found in ModelRouter');
        console.log(`   Provider: ${tiers.smart.provider}`);
        console.log(`   Model: ${tiers.smart.model}`);
    } else {
        console.error('❌ "smart" tier NOT found in ModelRouter');
    }

    // 1.5 Verify Proactive Routing
    console.log('\n[1.5] Verifying Proactive Routing Logic...');
    process.env.ABACUS_API_KEY = 'dummy_key_for_logic_test'; 
    const codingRoute = router.routeByTaskType('coding');
    if (codingRoute.tier === 'smart') {
        console.log('✅ Proactive Upgrade: "coding" (balanced) task correctly upgraded to "smart" tier with Abacus key.');
    } else {
        console.error(`❌ Proactive Upgrade Failed: "coding" task is still "${codingRoute.tier}" tier.`);
    }
    
    // Reset key for live test check
    if (!apiKey) delete process.env.ABACUS_API_KEY;
    else process.env.ABACUS_API_KEY = apiKey;

    // 2. Verify Provider Creation
    console.log('\n[2] Verifying Provider Creation via Factory...');
    try {
        const provider = LLMFactory.createProvider('abacus');
        console.log('✅ Successfully created AbacusProvider via LLMFactory');
        
        if (apiKey) {
            console.log('\n[3] Testing Live Connection (Sample Query)...');
            try {
                const response = await provider.chat([
                    { role: 'user', content: 'What is the capital of France?' }
                ], { model: 'route-llm' });
                
                console.log('✅ Live Response Received:');
                console.log(`   Content: ${response.content.substring(0, 50)}...`);
                console.log(`   Model Used: ${response.model}`);
                console.log(`   Tokens: In=${response.usage.inputTokens}, Out=${response.usage.outputTokens}`);
            } catch (err: any) {
                console.error(`❌ Live Test Failed: ${err.message}`);
            }
        } else {
            console.log('\n[3] Skipping Live Test (No API Key)');
        }
    } catch (err: any) {
        console.error(`❌ Provider Creation Failed: ${err.message}`);
    }

    console.log('\n--- Verification Complete ---');
}

main().catch(console.error);
