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

async function verifyHistory() {
    console.log('--- Verifying Studio Audit History ---');

    // Import handlers
    const { default: spellingHandler } = await import('../api/spelling.js');
    const { default: historyHandler } = await import('../api/history.js');

    // 1. Generate a transaction (Spelling)
    console.log('\n1. Generating Transaction...');
    const spellReq = {
        method: 'POST',
        url: 'http://localhost/api/spelling/fix',
        json: async () => ({ text: 'History Verification Test' })
    };
    await spellingHandler(spellReq);
    console.log('✅ Transaction completed');

    // 2. Fetch History
    console.log('\n2. Fetching History...');
    // We used the demo key hash in spelling.js, so we query with the demo key
    const demoKey = 'ac_live_demo_key_12345';
    const histReq = {
        method: 'GET',
        url: `http://localhost/api/history?apiKey=${demoKey}`,
        json: async () => ({})
    };

    const histRes = await historyHandler(histReq);
    const histData = await histRes.json();

    if (histData.logs && histData.logs.length > 0) {
        const latest = histData.logs[0];
        console.log('✅ History retrieved');
        console.log('   Latest Log:', latest.module, '|', latest.input, '->', latest.status);

        if (latest.input.includes('History Verification')) {
            console.log('✅ Verification Successful: Found recent transaction.');
        } else {
            console.warn('⚠️ Warning: Latest log does not match current transaction. (Might be old logs)');
        }
    } else {
        console.error('❌ History empty (Logging failed)');
    }
}

verifyHistory();
