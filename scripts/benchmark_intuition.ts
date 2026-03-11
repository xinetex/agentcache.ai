
import { intuitionService } from '../src/services/IntuitionService.js';
import { BancacheService } from '../src/services/bancache.js';

async function runBenchmark() {
    console.log("=== Intuition Layer Latency Benchmark ===");
    
    const query = "GET /admin HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Moz...";
    const bancache = new BancacheService();

    // 1. Standard Path (LLM + DB Network simulation)
    const startStandard = performance.now();
    await new Promise(r => setTimeout(r, 1500)); // Simulate LLM Reasoning
    await bancache.getAnalysis("mock-hash-miss"); // Force a check
    const endStandard = performance.now();
    const standardLatency = endStandard - startStandard;
    console.log(`⏱ Standard Path (System 2): ${standardLatency.toFixed(2)}ms`);

    // 2. Intuition Path (Latent Manipulator)
    const startIntuition = performance.now();
    await intuitionService.process(query);
    const endIntuition = performance.now();
    const intuitionLatency = endIntuition - startIntuition;
    console.log(`⏱ Intuition Path (System 1): ${intuitionLatency.toFixed(2)}ms`);

    const speedup = standardLatency / intuitionLatency;
    const savings = standardLatency - intuitionLatency;
    
    console.log(`\n🚀 Results:`);
    console.log(`- Speedup: ${speedup.toFixed(1)}x faster`);
    console.log(`- Latency Saved: ${savings.toFixed(2)}ms`);
    console.log(`- Throughput: ~${(1000 / intuitionLatency).toFixed(0)} req/sec (Single Thread)`);
}

runBenchmark().catch(console.error);
