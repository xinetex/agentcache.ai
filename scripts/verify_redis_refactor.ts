import { redis, appendToSession, getSessionHistory } from '../src/lib/redis.js';

async function verify() {
    console.log('Testing Redis Client...');

    try {
        // 1. Basic Set/Get
        await redis.set('test_key', 'hello_world');
        const val = await redis.get('test_key');
        console.log(`GET test_key: ${val} ${val === 'hello_world' ? '✅' : '❌'}`);

        // 2. SetEx
        await redis.setex('test_ex', 10, 'expires_soon');
        const valEx = await redis.get('test_ex');
        console.log(`GET test_ex: ${valEx} ${valEx === 'expires_soon' ? '✅' : '❌'}`);

        // 3. Lists (Session History)
        await appendToSession('test_session', { role: 'user', content: 'hi' });
        const history = await getSessionHistory('test_session');
        console.log(`Session History: ${history.length} items ${history.length >= 1 ? '✅' : '❌'}`);
        console.log('First item:', history[0]);

        console.log('Verification Complete!');
        process.exit(0);
    } catch (e) {
        console.error('Verification Failed:', e);
        process.exit(1);
    }
}

verify();
