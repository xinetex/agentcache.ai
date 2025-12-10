import 'dotenv/config';
import { PatternEngine } from '../src/infrastructure/PatternEngine.js';

async function genesis() {
    const engine = new PatternEngine();
    console.log('\n🌌 INITIATING GENESIS EVENT 🌌');
    console.log('Seeding the Excitable Medium with primal forces...\n');

    // 1. The Dreamer (Generator)
    try {
        await engine.invoke(
            'The Dreamer',
            'To populate the collective unconscious with latent ideas.',
            [{ type: 'generate_thought' }],
            { type: 'cron', value: '*/2 * * * *' } // Every 2 "minutes" (simulated check)
        );
        console.log('✨ "The Dreamer" has awakened.');
    } catch (e) { console.log('The Dreamer already exists (or failed).'); }

    // 2. The Warden (Protector)
    try {
        await engine.invoke(
            'The Warden',
            'To maintain the purity of the medium.',
            [{ type: 'scan_anomalies' }],
            { type: 'cron', value: '*/1 * * * *' } // Every 1 "minute"
        );
        console.log('🛡️ "The Warden" is standing guard.');
    } catch (e) { console.log('The Warden already exists.'); }

    // 3. The Recycler (Optimizer)
    try {
        await engine.invoke(
            'The Recycler',
            'To ensure nothing is wasted.',
            [{ type: 'recycle_entropy' }],
            { type: 'cron', value: '*/3 * * * *' }
        );
        console.log('♻️ "The Recycler" has begun its work.');
    } catch (e) { console.log('The Recycler already exists.'); }

    console.log('\nGenesis complete. The medium is now alive.');
    process.exit(0);
}

genesis();
