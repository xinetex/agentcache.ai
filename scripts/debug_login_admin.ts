
import handler from '../api/auth/login.js';
import 'dotenv/config';

// Mock Request/Response
class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.headers = {};
        this.body = null;
    }
    status(code) {
        this.statusCode = code;
        return this;
    }
    json(data) {
        this.body = JSON.stringify(data);
        return this;
    }
    setHeader(key, value) {
        this.headers[key] = value;
        return this;
    }
}

// Next.js Edge/App Router Polyfill for Response
global.Response = class Response {
    constructor(body, init) {
        this.body = body;
        this.status = init?.status || 200;
        this.headers = init?.headers || {};
    }
    async json() {
        return JSON.parse(this.body);
    }
};

async function testLogin() {
    console.log("🔍 Debugging Admin Login...");

    const req = {
        method: 'POST',
        headers: {},
        json: async () => ({
            email: 'admin@agentcache.ai',
            password: 'AdminPassword123!'
        })
    };

    try {
        const res = await handler(req);
        console.log(`\n📄 Status: ${res.status}`);

        if (res.status === 200) {
            const data = await res.json();
            console.log("✅ Login Successful!");
            console.log("\n⬇️ YOUR JWT TOKEN ⬇️");
            console.log(data.token);
            console.log("⬆️ COPY THIS ⬆️\n");
        } else {
            const err = await res.json();
            console.error("❌ Login Failed:", err);
        }
    } catch (e) {
        console.error("💥 CRITICAL HANDLER ERROR:", e);
    }
    process.exit(0);
}

testLogin();
