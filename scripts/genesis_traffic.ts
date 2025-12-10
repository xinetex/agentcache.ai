import 'dotenv/config';
import { PatternEngine } from '../src/infrastructure/PatternEngine.js';

async function genesisTraffic() {
    const engine = new PatternEngine();
    console.log('\n🚦 INITIATING TRAFFIC SENSOR DEPLOYMENT 🚦');

    try {
        await engine.invoke(
            'Traffic Watcher',
            'To sense the flow of the city and bridge physical speed to digital thought.',
            [{ type: 'sense_traffic' }],
            { type: 'cron', value: '*/15 * * * * *' } // Every 15 seconds (frequent checks)
        );
        console.log('📸 "Traffic Watcher" is now online and monitoring the grid.');
    } catch (e) { console.log('Traffic Watcher already exists.'); }

    process.exit(0);
}

genesisTraffic();
