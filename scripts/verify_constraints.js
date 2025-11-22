import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Mock Request/Response globals for Edge Runtime
if (!global.Response) {
    global.Response = class Response {
        constructor(body, init) {
            this.body = body;
            this.status = init?.status || 200;
            this.headers = new Map(Object.entries(init?.headers || {}));
        }
        async json() { return JSON.parse(this.body); }
    };
}

async function verifyConstraints() {
    console.log('--- Verifying Constraint Enforcement Protocol ---');

    // Dynamic import to ensure env vars are loaded first
    const { default: handler } = await import('../api/constraints.js');

    // Prompt designed to trigger an em-dash from the LLM
    const prompt = 'Write a single sentence that uses an em-dash punctuation mark.';
    const constraint = 'no_em_dash';

    // 1. Test First Run (Miss + Violation Check)
    console.log('Testing First Run (Cache Miss)...');
    const req1 = {
        method: 'POST',
        url: 'http://localhost/api/constraints/enforce',
        json: async () => ({ prompt, constraint })
    };

    const res1 = await handler(req1);
    const body1 = await res1.json();
    console.log('Response 1:', body1);

    if (body1.cached === false) {
        console.log('✅ First run successful (LLM called)');
        if (body1.violationLog && body1.violationLog.length > 0) {
            console.log('✅ Violation detected and corrected');
        } else {
            console.log('ℹ️ No violation detected (LLM might have obeyed initially)');
        }
    } else {
        console.error('❌ First run failed');
        return;
    }

    // 2. Test Second Run (Hit)
    console.log('\nTesting Second Run (Cache Hit)...');
    const req2 = {
        method: 'POST',
        url: 'http://localhost/api/constraints/enforce',
        json: async () => ({ prompt, constraint })
    };

    const res2 = await handler(req2);
    const body2 = await res2.json();
    console.log('Response 2:', body2);

    if (body2.cached === true && body2.output === body1.output) {
        console.log('✅ Second run successful (Cache Hit)');
    } else {
        console.error('❌ Second run failed');
    }
}

verifyConstraints();
