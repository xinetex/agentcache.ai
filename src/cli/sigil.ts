/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import 'dotenv/config';
import { PatternEngine } from '../infrastructure/PatternEngine.js';

async function main() {
    const args = process.argv.slice(2);
    const intent = args.join(' ');

    if (!intent) {
        console.error('Usage: npm run sigil "Your Intent Here"');
        process.exit(1);
    }

    console.log(`\n🔮 Vocal Sigil Detected: "${intent}"`);
    console.log('----------------------------------------');

    const engine = new PatternEngine();

    // Map intent to a simple action for the "Excitable Medium"
    // In a full implementation, this uses an LLM to generate code/JSON actions.
    // For MVP, we map specific keywords or default to a log action.

    let actionSequence;
    let name = 'Sigil-' + Math.random().toString(36).substring(7);

    if (intent.toLowerCase().includes('optimize')) {
        name = 'Optimizer-Servitor';
        actionSequence = { type: 'update_cache', message: 'Optimizing cache performance...' };
    } else {
        actionSequence = { type: 'log', message: `Manifesting intent: ${intent}` };
    }

    try {
        const pattern = await engine.invoke(name, intent, actionSequence);
        console.log(`\n✨ Servitor Created: ${pattern.name} (ID: ${pattern.id})`);
        console.log(`   Status: ${pattern.status}`);
        console.log(`   Energy: ${pattern.energyLevel}`);
        console.log('\nThe pattern is now active in the Excitable Medium.\n');
        process.exit(0);
    } catch (error) {
        console.error('Failed to cast sigil:', error);
        process.exit(1);
    }
}

main();
