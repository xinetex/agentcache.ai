import fetch from 'node-fetch';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const API_KEY = 'ac_benchmark_key';

// Simulation Parameters
const TOTAL_REQUESTS = 100; // Scale this up for real stress testing
const CONCURRENCY = 10;
const CACHE_HIT_RATIO = 0.8; // 80% of requests are repeats

// Metrics
const BASELINE_LATENCY_MS = 1500; // Simulated LLM latency
const JOULES_PER_TOKEN = 0.04; // Est. energy per token on H100
const TOKENS_PER_REQ = 500; // Avg tokens

async function runBenchmark() {
    console.log(`🚀 Starting AgentCache Cluster Benchmark`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`Workload: ${TOTAL_REQUESTS} requests, ${CONCURRENCY} concurrent agents`);
    console.log(`--------------------------------------------------`);

    const start = performance.now();
    let completed = 0;
    let cacheHits = 0;
    let totalLatency = 0;

    const queue = Array.from({ length: TOTAL_REQUESTS }, (_, i) => i);

    // Worker function
    const worker = async () => {
        while (queue.length > 0) {
            const id = queue.shift();

            // Determine if this should be a cache hit or miss
            // For simulation, we use a fixed set of prompts.
            // 80% chance to pick from the first 20% of prompts (Zipfian-ish)
            const isRepeat = Math.random() < CACHE_HIT_RATIO;
            const promptId = isRepeat ? Math.floor(Math.random() * (TOTAL_REQUESTS * 0.2)) : id;
            const prompt = `Benchmark Prompt ID ${promptId}`;

            const reqStart = performance.now();
            try {
                const res = await fetch(`${BASE_URL}/api/spelling/fix`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: prompt, apiKey: API_KEY })
                });
                const data = await res.json();

                const reqEnd = performance.now();
                const latency = reqEnd - reqStart;
                totalLatency += latency;
                if (data.cached) cacheHits++;

                process.stdout.write('.');
            } catch (err) {
                process.stdout.write('x');
            }
            completed++;
        }
    };

    // Run workers
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const end = performance.now();
    const duration = (end - start) / 1000; // seconds

    console.log(`\n\n✅ Benchmark Complete in ${duration.toFixed(2)}s`);

    // Analysis
    const avgLatency = totalLatency / TOTAL_REQUESTS;
    const throughput = TOTAL_REQUESTS / duration;

    // Virtual GPU Calculation
    // How many requests/sec would the Baseline handle?
    // Baseline Throughput = 1000ms / request = 1 req/sec per thread? 
    // Let's say Baseline Latency is 1.5s. 
    // Speedup Factor = Baseline Latency / Avg Latency
    const speedup = BASELINE_LATENCY_MS / avgLatency;

    // Energy Calculation
    // Energy Saved = (Cache Hits * Tokens * Joules/Token)
    const energySaved = cacheHits * TOKENS_PER_REQ * JOULES_PER_TOKEN;

    console.log(`--------------------------------------------------`);
    console.log(`📊 Results:`);
    console.log(`   Avg Latency:     ${avgLatency.toFixed(2)} ms`);
    console.log(`   Baseline (LLM):  ${BASELINE_LATENCY_MS.toFixed(2)} ms`);
    console.log(`   Speedup Factor:  ${speedup.toFixed(1)}x`);
    console.log(`   Throughput:      ${throughput.toFixed(1)} req/s`);
    console.log(`   Cache Hit Rate:  ${((cacheHits / TOTAL_REQUESTS) * 100).toFixed(1)}%`);
    console.log(`--------------------------------------------------`);
    console.log(`🔋 Green AI Metrics:`);
    console.log(`   Energy Saved:    ${energySaved.toFixed(2)} Joules`);
    console.log(`   Virtual GPUs:    ${speedup.toFixed(1)} vGPUs`);
    console.log(`--------------------------------------------------`);
}

runBenchmark();
