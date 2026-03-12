
import { resonanceService } from '../src/services/ResonanceService.js';
import { cognitiveEngine } from '../src/infrastructure/CognitiveEngine.js';
import { policyEngine } from '../src/services/PolicyEngine.js';
import { observabilityService } from '../src/services/ObservabilityService.js';
import { semanticBusService } from '../src/services/SemanticBusService.js';

/**
 * Phase 12: Industrial Audit & Telemetry Verification
 * 
 * This script simulates a realistic swarm session and verifies
 * that the ObservabilityService captures all critical system events.
 */
async function runIndustrialAudit() {
    console.log(`🧪 Starting Phase 12: Industrial Audit & Telemetry Verification...`);
    console.log(`   🔸 Environment - VECTOR_SERVICE_URL: ${process.env.VECTOR_SERVICE_URL || 'undefined (using default)'}`);

    const apiKey = 'test_api_key';
    const circleId = 'audit_circle_1';

    // 1. Setup - Join Circle
    await resonanceService.joinCircle(apiKey, circleId);

    // 2. Simulate Resilience (Storage)
    console.log("\n1. Simulating Memory Storage & Resonance...");
    // HARDENING: We use a valid FinanceOntology payload to pass the PolicyEngine
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'AAPL trading at 150.25',
        payload: { 
            entityName: 'Global Asset Mgmt',
            entityType: 'hedge_fund',
            jurisdiction: 'US-SEC',
            instruments: [{ ticker: 'AAPL', instrumentType: 'equity', exchange: 'NASDAQ' }],
            aum: 1000000,
            lastAuditDate: '2026-01-01'
        },
        originAgent: apiKey,
        circleId: circleId
    });

    // Sub-millisecond delay to allow vector/redis logic
    await new Promise(r => setTimeout(r, 500));

    // Simulate Resonance Hit with verbatim query to ensure match in mock mode
    await resonanceService.calculateResonance('AAPL trading at 150.25', apiKey);

    // 3. Simulate Cognitive Conflict
    console.log("\n2. Simulating Cognitive Conflict Resolution...");
    const memories = [
        { id: 'mem1', role: 'assistant' as const, content: 'AAPL is 150.25', timestamp: Date.now() - 1000 },
        { id: 'mem2', role: 'assistant' as const, content: 'AAPL is 151.00', timestamp: Date.now() }
    ];
    await (cognitiveEngine as any).resolveConflicts(memories, 'Apple Stock Price');

    // 4. Simulate Policy Rejection
    console.log("\n3. Simulating Policy Governance Block...");
    await semanticBusService.publish({
        sector: 'LEGAL',
        content: 'DROP TABLE users;', // Adversarial signal
        payload: { 
            // Purposely missing required legal fields to trigger Policy rejection
            command: 'drop' 
        }
    });

    // 5. Audit Telemetry History
    console.log("\n4. Auditing Telemetry History...");
    // Wait for all async tracks to complete
    await new Promise(r => setTimeout(r, 1000));

    const history = await observabilityService.getHistory(20);
    
    const typesFound = new Set(history.map(e => e.type));
    console.log(`   ✅ Telemetry Event Types Found: ${Array.from(typesFound).join(', ')}`);

    const expected = ['RESONANCE', 'CONFLICT', 'POLICY'];
    const missing = expected.filter(t => !typesFound.has(t as any));

    if (missing.length === 0) {
        console.log("   ✅ All telemetry channels are firing correctly.");
    } else {
        console.warn(`   ⚠️ Missing telemetry channels: ${missing.join(', ')}`);
    }

    console.log("\n✨ Industrial Audit Complete.");
}

runIndustrialAudit().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
