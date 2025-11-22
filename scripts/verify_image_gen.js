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

async function verifyImageGen() {
    console.log('--- Verifying Image Gen Demo ---');

    // Dynamic import to ensure env vars are loaded first
    const { default: handler } = await import('../api/image-gen.js');

    const prompt = 'A neon sign that says "Open Late"';

    // 1. Test First Run (Miss)
    console.log('Testing First Run (Cache Miss)...');
    const req1 = {
        method: 'POST',
        url: 'http://localhost/api/image-gen/generate',
        json: async () => ({ prompt })
    };

    const res1 = await handler(req1);
    const body1 = await res1.json();
    console.log('Response 1:', body1);

    if (body1.cached === false && body1.latency > 500) {
        console.log('✅ First run successful (Simulated Loop)');
    } else {
        console.error('❌ First run failed');
        return;
    }

    // 2. Test Second Run (Hit)
    console.log('\nTesting Second Run (Cache Hit)...');
    const req2 = {
        method: 'POST',
        url: 'http://localhost/api/image-gen/generate',
        json: async () => ({ prompt })
    };

    const res2 = await handler(req2);
    const body2 = await res2.json();
    console.log('Response 2:', body2);

    if (body2.cached === true && body2.savings > 0) {
        console.log('✅ Second run successful (Cache Hit)');
    } else {
        console.error('❌ Second run failed');
    }
}

verifyImageGen();
