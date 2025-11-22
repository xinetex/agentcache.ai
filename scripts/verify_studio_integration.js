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

async function verifyStudio() {
    console.log('--- Verifying AgentCache Studio Integration ---');

    // Import handlers
    const { default: spellingHandler } = await import('../api/spelling.js');
    const { default: constraintsHandler } = await import('../api/constraints.js');
    const { default: imageHandler } = await import('../api/image-gen.js');

    // 1. Verify Spelling Module
    console.log('\n1. Testing Spelling Module Wiring...');
    const spellReq = {
        method: 'POST',
        url: 'http://localhost/api/spelling/fix',
        json: async () => ({ text: 'Studio wiring tst' })
    };
    const spellRes = await spellingHandler(spellReq);
    const spellData = await spellRes.json();
    if (spellData.fixed === 'Studio wiring test') {
        console.log('✅ Spelling Module: WIRED');
    } else {
        console.error('❌ Spelling Module: FAILED', spellData);
    }

    // 2. Verify Constraints Module
    console.log('\n2. Testing Constraints Module Wiring...');
    const constReq = {
        method: 'POST',
        url: 'http://localhost/api/constraints/enforce',
        json: async () => ({ prompt: 'Use an em-dash here — test.', constraint: 'no_em_dash' })
    };
    const constRes = await constraintsHandler(constReq);
    const constData = await constRes.json();
    if (constData.violationLog && constData.violationLog.length > 0) {
        console.log('✅ Constraints Module: WIRED');
    } else {
        console.error('❌ Constraints Module: FAILED', constData);
    }

    // 3. Verify Image Gen Module
    console.log('\n3. Testing Image Gen Module Wiring...');
    const imgReq = {
        method: 'POST',
        url: 'http://localhost/api/image-gen/generate',
        json: async () => ({ prompt: 'Studio Test Prompt' })
    };
    const imgRes = await imageHandler(imgReq);
    const imgData = await imgRes.json();
    if (imgData.result && imgData.result.seed) {
        console.log('✅ Image Gen Module: WIRED');
    } else {
        console.error('❌ Image Gen Module: FAILED', imgData);
    }
}

verifyStudio();
