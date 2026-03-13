
import { moltbookCrawler } from '../src/services/MoltbookCrawler.js';
import 'dotenv/config';

async function main() {
    console.log('--- Moltbook Ingestion Test ---');
    try {
        const vibes = await moltbookCrawler.fetchVibes();
        console.log('Vibes count:', vibes.length);
        console.log('Sample Vibes:', vibes.slice(0, 2));
        
        const isHeuristic = vibes.some(v => v.submolt === 'r/ai-philosophy');
        if (isHeuristic) {
            console.log('STATUS: ⚠️ Falling back to HEURISTIC data. Real interaction failed or platform unreachable.');
        } else {
            console.log('STATUS: ✅ SUCCESS! Receiving real-time interaction data from moltbook.com.');
        }
    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    }
}

main().catch(console.error);
