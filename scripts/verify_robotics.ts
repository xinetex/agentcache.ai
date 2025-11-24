import { Redis } from '@upstash/redis';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'ac_demo_robotics_test'; // Use demo key for local test
const TEST_URL = 'https://example.com'; // Stable URL for testing

async function runTest() {
    console.log('🤖 Starting Robotics API Verification...');
    console.log(`Target: ${API_URL}`);

    // 1. Register a Listener
    console.log('\n1. Registering Listener...');
    const registerRes = await fetch(`${API_URL}/api/listeners/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            url: TEST_URL,
            checkInterval: 3600000, // 1 hour (demo limit)
            namespace: 'robotics-test',
            invalidateOnChange: true
        })
    });

    const registerData = await registerRes.json();
    if (!registerRes.ok) {
        console.error('❌ Registration Failed:', registerData);
        process.exit(1);
    }
    console.log('✅ Listener Registered:', registerData.listenerId);
    const listenerId = registerData.listenerId;

    // 2. Verify Listener Exists
    console.log('\n2. Verifying Listener Existence...');
    const listRes = await fetch(`${API_URL}/api/listeners/register`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const listData = await listRes.json();
    const found = listData.listeners.find((l: any) => l.id === listenerId);

    if (!found) {
        console.error('❌ Listener not found in list:', listData);
        process.exit(1);
    }
    console.log('✅ Listener Found:', found.url);

    // 3. Simulate Watchdog Check (via Cron API)
    // Note: This requires CRON_SECRET. For local test, we might skip or mock.
    // If running against production, we need the real secret.
    if (process.env.CRON_SECRET) {
        console.log('\n3. Triggering Watchdog (Cron)...');
        const cronRes = await fetch(`${API_URL}/api/cron/monitor`, {
            headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
        });
        const cronData = await cronRes.json();
        console.log('✅ Watchdog Result:', cronData);
    } else {
        console.log('\n⚠️ Skipping Watchdog Trigger (Missing CRON_SECRET)');
    }

    // 4. Invalidate Cache (Manual)
    console.log('\n4. Testing Manual Invalidation...');
    const invalidateRes = await fetch(`${API_URL}/api/cache/invalidate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            namespace: 'robotics-test',
            reason: 'verification_script'
        })
    });

    const invalidateData = await invalidateRes.json();
    if (!invalidateRes.ok) {
        console.error('❌ Invalidation Failed:', invalidateData);
        process.exit(1);
    }
    console.log('✅ Invalidation Success:', invalidateData);

    // 5. Cleanup (Unregister)
    console.log('\n5. Cleaning Up...');
    const deleteRes = await fetch(`${API_URL}/api/listeners/register?id=${listenerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });

    if (!deleteRes.ok) {
        console.error('❌ Cleanup Failed');
    } else {
        console.log('✅ Listener Unregistered');
    }

    console.log('\n✨ Robotics API Verification Complete!');
}

runTest().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
