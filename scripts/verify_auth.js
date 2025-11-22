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

async function verifyAuth() {
    console.log('--- Verifying Studio Authentication ---');

    // Import handler
    const { default: handler } = await import('../api/auth/verify.js');

    // 1. Test Invalid Key
    console.log('\n1. Testing Invalid Key...');
    const req1 = {
        method: 'POST',
        url: 'http://localhost/api/auth/verify',
        json: async () => ({ apiKey: 'invalid_key' })
    };
    const res1 = await handler(req1);
    const body1 = await res1.json();

    if (body1.valid === false) {
        console.log('✅ Invalid key rejected');
    } else {
        console.error('❌ Invalid key accepted (Unexpected)', body1);
    }

    // 2. Test Demo Key
    console.log('\n2. Testing Demo Key...');
    const req2 = {
        method: 'POST',
        url: 'http://localhost/api/auth/verify',
        json: async () => ({ apiKey: 'ac_live_demo_key_12345' })
    };
    const res2 = await handler(req2);
    const body2 = await res2.json();

    if (body2.valid === true && body2.email === 'demo@agentcache.ai') {
        console.log('✅ Demo key accepted');
        console.log('   Plan:', body2.plan);
        console.log('   Quota:', body2.quota);
    } else {
        console.error('❌ Demo key rejected', body2);
    }
}

verifyAuth();
