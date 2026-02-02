
import { redis } from '../src/lib/redis.js';

async function testSettings() {
    console.log('Testing Settings Persistence...');
    const testData = {
        orgName: 'TEST_ORG',
        accentColor: '#123456',
        darkModeBg: '#abcdef'
    };

    console.log('1. Saving Settings to Redis Directly...');
    await redis.set('adminConfig:settings', JSON.stringify(testData));

    console.log('2. Reading Settings from Redis...');
    const saved = await redis.get('adminConfig:settings');
    console.log('Retrieved:', saved);

    if (saved && JSON.parse(saved).orgName === 'TEST_ORG') {
        console.log('✅ Redis Persistence Works');
    } else {
        console.error('❌ Redis Persistence Failed');
    }

    // Test API behavior simulation
    console.log('\nSimulating API Logic:');
    try {
        const body = testData;
        await redis.set('adminConfig:settings', JSON.stringify(body));
        const check = await redis.get('adminConfig:settings');
        const parsed = JSON.parse(check as string);
        console.log('API Logic Check:', parsed);
    } catch (e) {
        console.error('API Logic Failed:', e);
    }

    process.exit(0);
}

testSettings();
