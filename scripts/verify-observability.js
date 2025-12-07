
import { Tracer } from '../src/lib/observability/tracer.js';
import { EvalRunner } from '../src/lib/eval/eval.js';

console.log('Verifying Observability & Eval modules...');

try {
    // Test Tracer
    const tracer = new Tracer({ redisUrl: 'http://mock', redisToken: 'mock' });
    const span = tracer.startSpan('test_span', { foo: 'bar' });
    if (!span.id) throw new Error('Span ID missing');
    console.log('Span created:', span.id);

    tracer.endSpan(span);
    const traceId = tracer.getTraceId();
    if (!traceId) throw new Error('Trace ID missing');
    console.log('Span ended. Trace ID:', traceId);

    // Test EvalRunner instantiation (mocking dependencies is hard in loose script, just loading is good)
    const runner = new EvalRunner();
    console.log('EvalRunner instantiated.');

    console.log('SUCCESS: Modules loaded and basic logic verified.');
} catch (err) {
    console.error('FAILURE:', err);
    process.exit(1);
}
