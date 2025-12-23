
import { PatternEngine } from '../src/infrastructure/PatternEngine.js';
import { db } from '../src/db/client.js';
import { agentAlerts } from '../src/db/schema.js';
import { eq, desc } from 'drizzle-orm';

async function main() {
    console.log('🧪 Starting Distress Signal Verification...');

    const engine = new PatternEngine();

    // Mock pattern
    const mockPattern = {
        id: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID
        name: 'Test Agent Bond',
        intent: 'Verify Distress Signal',
        energyLevel: 10,
        actionSequence: {
            type: 'signal_distress',
            message: 'I require immediate assistance, 007.',
            severity: 'critical'
        }
    };

    // Execute
    await engine.executeAction(mockPattern);

    // Verify DB
    console.log('🔍 Checking Database for Alert...');
    // Give it a split second to persist (though await should handle it)
    await new Promise(r => setTimeout(r, 1000));

    const alerts = await db.select().from(agentAlerts).orderBy(desc(agentAlerts.createdAt)).limit(1);

    if (alerts.length > 0) {
        const latest = alerts[0];
        console.log('✅ Alert Found:', latest);
        if (latest.agentName === 'Test Agent Bond' && latest.message === 'I require immediate assistance, 007.') {
            console.log('✅ Verification PASSED: Distress Signal persisted correctly.');
            process.exit(0);
        } else {
            console.error('❌ Verification FAILED: Content mismatch.', latest);
            process.exit(1);
        }
    } else {
        console.error('❌ Verification FAILED: No alert found in database.');
        process.exit(1);
    }
}

main().catch(console.error);
