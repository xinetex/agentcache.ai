import { BitAgentPool } from '../src/lib/swarm/BitAgent.js';
import { BoidsEngine } from '../src/services/BoidsEngine.js';

async function runBenchmark(size: number, iterations: number) {
    console.log(`\n🚀 Benchmarking ${size.toLocaleString()} agents...`);
    const pool = new BitAgentPool(size);
    pool.initialize(1000, 1000);
    const engine = new BoidsEngine();

    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
        engine.update(pool, 1/60);
    }
    const end = Date.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;

    console.log(`✅ Completed ${iterations} iterations`);
    console.log(`⏱ Total Time: ${totalTime}ms`);
    console.log(`⏱ Avg Time per iteration: ${avgTime.toFixed(2)}ms`);
    console.log(`📊 IPS (Iterations Per Second): ${(1000 / avgTime).toFixed(2)}`);
}

async function main() {
    console.log("=== Swarm Architecture Benchmark ===");
    await runBenchmark(1000, 100);    // 1k
    await runBenchmark(10000, 50);    // 10k
    await runBenchmark(100000, 10);   // 100k
    await runBenchmark(1000000, 5);    // 1M
}

main().catch(console.error);
