const fetch = require('node-fetch');

async function testSimulation() {
    try {
        const res = await fetch('http://localhost:3000/api/stats/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pattern: 'cyclic', cacheSize: 5, traceSize: 20 })
        });

        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();

        console.log('Simulation Result:', JSON.stringify(data, null, 2));

        if (data.predictive.rate > data.lru.rate) {
            console.log('✅ Predictive policy outperformed LRU as expected.');
        } else {
            console.log('⚠️ Predictive policy did not outperform LRU (check trace/cache size).');
        }
    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testSimulation();
