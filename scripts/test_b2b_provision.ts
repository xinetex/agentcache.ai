/**
 * Test B2B Service Provisioning
 */

async function testB2BProvision() {
    console.log('--- Testing B2B Provisioning ---');
    try {
        const res = await fetch('http://localhost:3001/api/b2b/provision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: 'test-client-123',
                type: 'GEO',
                intensity: 'aggressive',
                parameters: { brand: 'AgentCache.ai' }
            })
        });

        const data = await res.json();
        console.log('Provisioning Response:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('✅ B2B Provisioning SUCCESS!');
        } else {
            console.log('❌ B2B Provisioning FAILED!');
        }
    } catch (e) {
        console.error('Test failed:', e);
    }
}

testB2BProvision();
