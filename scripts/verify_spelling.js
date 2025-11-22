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

async function verifySpelling() {
    console.log('--- Verifying Spelling Correction Demo ---');

    // Dynamic import to ensure env vars are loaded first
    const { default: handler } = await import('../api/spelling.js');

    const text = 'Thsi is a tst of the sytem.';

    // 1. Test First Run (Miss)
    console.log('Testing First Run (Cache Miss)...');
    const req1 = {
        method: 'POST',
        url: 'http://localhost/api/spelling/fix',
        json: async () => ({ text })
    };

    const res1 = await handler(req1);
    const body1 = await res1.json();
    console.log('Response 1:', body1);

    if (body1.fixed && body1.cached === false) {
        console.log('✅ First run successful (LLM called)');
    } else {
        console.error('❌ First run failed');
        return;
    }

    // 2. Test Second Run (Hit)
    console.log('\nTesting Second Run (Cache Hit)...');
    const req2 = {
        method: 'POST',
        url: 'http://localhost/api/spelling/fix',
        json: async () => ({ text })
    };

    const res2 = await handler(req2);
    const body2 = await res2.json();
    console.log('Response 2:', body2);

    if (body2.fixed === body1.fixed && body2.cached === true) {
        console.log('✅ Second run successful (Cache Hit)');
    } else {
        console.error('❌ Second run failed');
    }
}

verifySpelling();
