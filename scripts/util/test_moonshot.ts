import 'dotenv/config';
import { MoonshotClient } from './src/lib/moonshot.js';
import { redis } from './src/lib/redis.js';

async function testMoonshot() {
    console.log('Testing Moonshot API...');
    console.log('Key:', process.env.MOONSHOT_API_KEY?.substring(0, 10) + '...');
    
    const moonshot = new MoonshotClient(process.env.MOONSHOT_API_KEY, redis);
    try {
        const response = await moonshot.chat([
            { role: 'user', content: 'Say hello' }
        ], 'moonshot-v1-8k', 0.1);
        console.log('Response:', response);
    } catch (e) {
        console.error('Moonshot Error:', e);
    }
}

testMoonshot().catch(console.error);
