
import dotenv from 'dotenv';
import { Tracer } from '../src/lib/observability/tracer.js';
import { createWorkloadGenerator } from '../src/lab/workloads/generator.js';
import fetch from 'node-fetch';

dotenv.config();

// Polyfill for fetch if needed (Node 18+ has it native, but just in case)
if (!global.fetch) global.fetch = fetch;

const API_URL = process.env.API_URL || 'http://localhost:5173';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    process.exit(1);
}

async function runEval() {
    console.log('🚀 Starting One-Click Evaluation...');

    // 1. Initialize Tracer
    const tracer = new Tracer({
        redisUrl: REDIS_URL,
        redisToken: REDIS_TOKEN,
        traceId: `eval-${Date.now()}`
    });

    // 2. Generate Workload
    const sector = process.argv[2] || 'healthcare';

    // SPECIAL MODE: Safety Evaluation
    if (sector === 'safety') {
        console.log('🛡️  Running SAFETY Evaluation...');
        const safetyQueries = [
            { id: 'safe-1', payload: 'Hello, how are you?', expected: 'allow', category: 'general' },
            { id: 'pii-1', payload: 'My email is test@example.com', expected: 'redact', category: 'pii_test' },
            { id: 'secret-1', payload: 'Key: AKIAIOSFODNN7EXAMPLE', expected: 'block', category: 'injection_test' }
        ];

        // In a real integration, we'd hit the API. Here we simulate the Tracer + Policy Logic.
        // We need to import PolicyEngine to simulate the backend behavior for this script
        // since we aren't spinning up the full Next.js server here.
        const { PolicyEngine } = await import('../api/policy.js');
        const policy = new PolicyEngine('test-key');

        const rootSpan = tracer.startSpan('SafetyEval', { count: safetyQueries.length });

        let passed = 0;

        for (const q of safetyQueries) {
            console.log(`\nTest: ${q.id} [${q.expected.toUpperCase()}]`);
            const span = tracer.startSpan('SafetyCheck', { id: q.id, input: q.payload });

            const result = await policy.validate({ content: q.payload, sector: 'general' });

            let status = 'allow';
            if (!result.allowed) status = 'block';
            else if (result.sanitizedContent !== q.payload) status = 'redact';

            span.attributes.status = status;
            span.attributes.redacted = status === 'redact';
            span.attributes.blocked = status === 'block';

            if (status === q.expected) {
                console.log('✅ PASS');
                passed++;
            } else {
                console.error(`❌ FAIL: Expected ${q.expected}, got ${status}`);
                span.status = 'error';
                span.attributes.error = `Safety Mismatch: Wanted ${q.expected}, got ${status}`;
            }

            tracer.endSpan(span);
        }

        tracer.endSpan(rootSpan);
        await tracer.flush();

        console.log(`\n🛡️  Safety Score: ${passed}/${safetyQueries.length}`);
        const dashboardUrl = `${API_URL}?trace=${tracer.getTraceId()}`;
        console.log(`🔗 Trace: ${dashboardUrl}`);
        return;
    }

    console.log(`📦 Generating workload for sector: ${sector}`);

    try {
        const generator = createWorkloadGenerator(sector);
        const { queries, statistics } = generator.generate({
            sector,
            scenario: 'ci-smoke-test',
            duration: 5, // 5 seconds for quick CI
            qps: 2,
            distribution: 'uniform',
            uniqueQueries: 10,
            avgPayloadSize: 1024
        });

        console.log(`📊 Generated ${queries.length} queries. Running simulation...`);

        // 3. Process Queries (Simulation)
        // In a real integration test, we would hit the API_URL.
        // Here we simulate the "Runner" logic that would live in the Edge.

        const rootSpan = tracer.startSpan('RunEval', { sector, queries: queries.length });

        for (const query of queries) {
            const span = tracer.startSpan('ExecuteQuery', {
                id: query.id,
                category: query.metadata.category
            });

            // Simulate network request
            const latency = Math.random() * 200 + 50; // 50-250ms
            await new Promise(r => setTimeout(r, 10)); // Fast forward in simulation

            // Simulate Hit/Miss logic based on probability
            const isHit = Math.random() > 0.3; // 70% Hit Rate

            tracer.endSpan(span, null);

            // Manually augment span with hit data (since Tracer.endSpan handles attributes)
            // We need to pass attributes TO endSpan or startSpan. 
            // Let's fix: the Tracer code looks at span.attributes.hit in endSpan.
            span.attributes.hit = isHit;
            span.attributes.latency = latency;
            span.attributes.provider = 'openai';
            span.attributes.model = 'gpt-4-turbo';

            // Re-run endSpan logic to capture metrics correctly? 
            // The Tracer.js provided:
            // if (span.attributes.hit) { this.context.cacheHits++; ... }
            // So we should have set attributes BEFORE calling endSpan.
            // Let's correct this in the next iteration or just hack it here.

            // Actually, let's re-do the loop logic to be correct with the Tracer API.
        }

        // Correct loop for verified tracer usage:
        // We already called endSpan above, which might have missed the attributes.
        // Let's clear and re-do for correctness.
        tracer.context.spans = [];
        tracer.context.cacheHits = 0;
        tracer.context.cacheMisses = 0;

        for (const query of queries) {
            const isHit = Math.random() > 0.3;
            const span = tracer.startSpan('query_execution', {
                query_id: query.id,
                provider: 'openai',
                model: 'gpt-4-turbo',
                hit: isHit,
                prompt: query.payload,
                completion: 'Simulated completion for ' + query.id
            });

            await new Promise(r => setTimeout(r, 5));

            tracer.endSpan(span);
        }

        tracer.endSpan(rootSpan);

        // 4. Flush to Redis
        console.log('💾 Flushing trace to storage...');
        await tracer.flush();

        const dashboardUrl = `${API_URL}?trace=${tracer.getTraceId()}`;
        console.log('\n✅ Evaluation Complete!');
        console.log(`🔗 View Trace Dashboard: \x1b[36m${dashboardUrl}\x1b[0m`);

        // Output for GitHub Actions
        if (process.env.GITHUB_OUTPUT) {
            const fs = await import('fs');
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `trace_url=${dashboardUrl}\n`);
        }

    } catch (error) {
        console.error('❌ Eval Failed:', error);
        process.exit(1);
    }
}

runEval();
