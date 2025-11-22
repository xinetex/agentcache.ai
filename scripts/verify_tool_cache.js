import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Mock the API handler locally since we can't fetch localhost easily in this env without running server
// Instead, we will import the handler logic if possible, or mock the Redis calls.
// Actually, we can use the `api/tool-cache.js` logic directly if we mock the request/response objects.

// But wait, `api/tool-cache.js` uses `process.env` which is available.
// Let's try to run it as a standalone script by importing it, but we need to mock Request/Response.

// Simpler approach: Use the same logic as the handler but run it directly against Redis to verify the keys are created.
// Or better: Just use the Redis client directly to simulate what the handler does, 
// OR trust the handler logic and just verify the Redis part.

// Let's try to actually run the handler function by mocking Request.
// import handler from '../api/tool-cache.js';

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

async function verifyToolCache() {
    console.log('--- Verifying Tool Execution Cache ---');

    // Dynamic import to ensure env vars are loaded first
    const { default: handler } = await import('../api/tool-cache.js');

    const tool = 'weather_api';
    const args = { city: 'San Francisco', date: '2025-11-22' };
    const result = { temp: 72, condition: 'Sunny' };

    // 1. Test SET
    console.log('Testing SET...');
    const setReq = {
        method: 'POST',
        url: 'http://localhost/api/tool-cache/set',
        headers: {
            get: (key) => key === 'x-api-key' ? 'ac_test_key' : null
        },
        json: async () => ({ tool, args, result })
    };

    const setRes = await handler(setReq);
    const setBody = await setRes.json();
    console.log('SET Response:', setBody);

    if (setBody.success) {
        console.log('✅ SET successful');
    } else {
        console.error('❌ SET failed');
        return;
    }

    // 2. Test GET
    console.log('\nTesting GET...');
    const getReq = {
        method: 'POST',
        url: 'http://localhost/api/tool-cache/get',
        headers: {
            get: (key) => key === 'x-api-key' ? 'ac_test_key' : null
        },
        json: async () => ({ tool, args })
    };

    const getRes = await handler(getReq);
    const getBody = await getRes.json();
    console.log('GET Response:', getBody);

    if (getBody.hit && getBody.result.temp === 72) {
        console.log('✅ GET successful (Hit)');
    } else {
        console.error('❌ GET failed');
    }
}

verifyToolCache();
