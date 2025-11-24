import { serializer } from '../src/lib/proto/serializer';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';

async function runBenchmark() {
    console.log('💸 Starting HFT Latency Benchmark...');
    console.log(`Target: ${API_URL}`);

    const payload = {
        scenarios: [
            "Analyze impact of CPI > 3.2% on 10Y Treasury",
            "Analyze impact of CPI < 2.9% on Tech Sector",
            "Analyze impact of Fed Pause on USD/JPY"
        ],
        priority: 'high'
    };

    // 1. JSON Benchmark
    console.log('\n1. Testing JSON Latency...');
    const startJson = performance.now();
    const resJson = await fetch(`${API_URL}/api/finance/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const endJson = performance.now();
    const jsonLatency = endJson - startJson;
    console.log(`JSON Latency: ${jsonLatency.toFixed(2)}ms`);

    if (!resJson.ok) {
        console.error('❌ JSON Request Failed');
        process.exit(1);
    }

    // 2. Binary Benchmark
    console.log('\n2. Testing Binary Protocol (ACBP) Latency...');

    // Serialize locally
    const envelope = {
        id: 'bench-1',
        type: 'order',
        timestamp: Date.now(),
        payload: payload
    };
    const serialized = serializer.serialize(envelope as any);

    const startBin = performance.now();
    const resBin = await fetch(`${API_URL}/api/finance/prewarm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Accept': 'application/octet-stream'
        },
        body: serialized.buffer.buffer as ArrayBuffer
    });
    const endBin = performance.now();
    const binLatency = endBin - startBin;

    console.log(`Binary Latency: ${binLatency.toFixed(2)}ms`);

    if (!resBin.ok) {
        console.error('❌ Binary Request Failed');
        process.exit(1);
    }

    const binBuffer = await resBin.arrayBuffer();
    const decoded = serializer.deserialize(new Uint8Array(binBuffer));
    console.log('Binary Response Decoded:', decoded.payload);

    // 3. Comparison
    const diff = jsonLatency - binLatency;
    console.log(`\n⚡ Speedup: ${diff.toFixed(2)}ms (${(diff / jsonLatency * 100).toFixed(1)}%)`);

    console.log('\n✨ Finance Verification Complete!');
}

runBenchmark().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
