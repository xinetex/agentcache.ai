/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { provocationEngine } from '../src/services/ProvocationEngine.js';
import { sloMonitor } from '../src/services/SLOMonitor.js';
import { semanticBusService } from '../src/services/SemanticBusService.js';
import { resonanceService } from '../src/services/ResonanceService.js';
import { ontologyRegistry } from '../src/ontology/OntologyRegistry.js';

/**
 * provocation_pack_v01
 * 
 * A repeatable chaos-performance verification suite for Phase 13.
 * It tests the system's ability to self-correct under three classes of stress.
 */
async function runProvocationPack() {
    console.log(`🧪 Starting Phase 13: Provocation Pack v0.1 (Chaos Loop Verification)...`);

    const originAgent = 'agent_chaos_tester';
    const circleId = 'chaos_circle_1';

    // 0. Setup
    await resonanceService.joinCircle(originAgent, circleId);

    // --- TEST 1: Infrastructure Chaos (Latency Stress) ---
    console.log(`\n1. Simulating Infrastructure Chaos: The Latency Storm...`);
    await provocationEngine.inject('LATENCY_STORM', { 
        type: 'INFRASTRUCTURE', 
        severity: 1.0, 
        durationMs: 2000 
    });

    const startTime = Date.now();
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'AAPL trading at 150.25',
        originAgent,
        circleId,
        payload: { instrument: 'AAPL', price: 150.25, currency: 'USD', exchange: 'NASDAQ' }
    });
    const duration = Date.now() - startTime;
    console.log(`   🔸 Publish duration under latency: ${duration}ms (Expected > 500ms)`);
    await provocationEngine.withdraw('LATENCY_STORM');


    // --- TEST 2: Input Chaos (Semantic Mutation) ---
    console.log(`\n2. Simulating Input Chaos: Signal Mutation...`);
    await provocationEngine.inject('SIGNAL_DRIFT', {
        type: 'INPUT',
        severity: 0.8
    });

    console.log(`   🔸 Sending malformed payload...`);
    // This will likely fail policy because content mutation will mess up extraction/validation
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'RECOVERY_SIGNAL_TEST',
        originAgent,
        circleId,
        payload: { instrument: 'RECOVERY', price: 100 } // Missing required fields for finance
    });

    await provocationEngine.withdraw('SIGNAL_DRIFT');


    // --- TEST 3: Cognitive Chaos (Resonance Inhibition) ---
    console.log(`\n3. Simulating Cognitive Chaos: Resonance Void...`);
    await provocationEngine.inject('COGNITIVE_VOID', {
        type: 'COGNITIVE',
        severity: 1.0
    });

    const resonanceHits = await resonanceService.calculateResonance('AAPL trading', originAgent);
    console.log(`   🔸 Resonance Hits during void: ${resonanceHits.length} (Expected: 0)`);
    
    await provocationEngine.withdraw('COGNITIVE_VOID');


    // --- TEST 4: Self-Correction Loop (SLO Verification) ---
    console.log(`\n4. Verifying Self-Correction Loop (The Golden Path)...`);
    
    // Step A: Trigger a rejection
    console.log(`   🔸 STEP A: Forcing ontological rejection...`);
    await semanticBusService.publish({
        sector: 'LEGAL',
        content: 'Drop Document',
        originAgent,
        payload: { command: 'drop' } // Fails Legal schema
    });

    // Step B: Simulate agent self-correction (retrying with valid payload)
    console.log(`   🔸 STEP B: Simulating agent self-correction after delay...`);
    await new Promise(r => setTimeout(r, 800)); // Simulate "Thinking Time"
    
    const validFinancePayload = {
        entityName: 'Alphabet Inc.',
        entityType: 'fintech',
        jurisdiction: 'US-SEC',
        instruments: [{
            ticker: 'GOOG',
            instrumentType: 'equity',
            exchange: 'NASDAQ',
            currency: 'USD'
        }],
        aum: 250000000000,
        lastAuditDate: '2025-12-31'
    };

    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'Valid Finance Signal',
        originAgent,
        circleId,
        payload: validFinancePayload
    });


    // --- FINAL AUDIT ---
    console.log(`\n📊 FINAL SLO SNAPSHOT:`);
    const snapshot = sloMonitor.getSnapshot();
    console.log(`   ✅ Resonance Success Rate: ${(snapshot.resonanceSuccessRate * 100).toFixed(1)}%`);
    console.log(`   ✅ Mean Correction Duration: ${snapshot.selfCorrectionLoopMs.length > 0 ? (snapshot.selfCorrectionLoopMs.reduce((a,b)=>a+b,0)/snapshot.selfCorrectionLoopMs.length).toFixed(0) : 'N/A'}ms`);
    console.log(`   ✅ P95 Latency: ${snapshot.latencyP95}ms`);

    if (snapshot.selfCorrectionLoopMs.length > 0) {
        console.log(`\n✨ Phase 13 Chaos Loop Verified. System autonomously recovered from intentional stress.`);
    } else {
        console.error(`\n❌ Phase 13 Verification Failed: No self-correction loops recorded.`);
    }
}

runProvocationPack().catch(console.error);
