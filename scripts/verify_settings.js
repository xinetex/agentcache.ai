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

async function verifySettings() {
    console.log('--- Verifying Control Panel ---');

    // Import handlers
    const { default: settingsHandler } = await import('../api/settings.js');
    const { default: spellingHandler } = await import('../api/spelling.js');

    const demoKey = 'ac_live_demo_key_12345';

    // 1. Disable Semantic Correction
    console.log('\n1. Disabling Semantic Correction...');
    const settings = { semantic_correction: false, cognitive_sentinel: true, constraint_enforcement: true };
    const saveReq = {
        method: 'POST',
        json: async () => ({ apiKey: demoKey, settings })
    };
    await settingsHandler(saveReq);
    console.log('✅ Settings saved (Semantic Correction: OFF)');

    // 2. Run Spelling Request
    console.log('\n2. Running Spelling Request...');
    const spellReq = {
        method: 'POST',
        url: 'http://localhost/api/spelling/fix',
        headers: new Map(),
        json: async () => ({ text: 'Thsi shoudl not be fixed', apiKey: demoKey })
    };

    const spellRes = await spellingHandler(spellReq);
    const spellData = await spellRes.json();

    if (spellData.status === 'skipped' && spellData.fixed === 'Thsi shoudl not be fixed') {
        console.log('✅ Verification Successful: Correction was skipped.');
    } else {
        console.error('❌ Verification Failed: Correction was NOT skipped.', spellData);
    }

    // 3. Re-enable Semantic Correction (Cleanup)
    console.log('\n3. Re-enabling Semantic Correction...');
    settings.semantic_correction = true;
    const restoreReq = {
        method: 'POST',
        json: async () => ({ apiKey: demoKey, settings })
    };
    await settingsHandler(restoreReq);
    console.log('✅ Settings restored');
}

verifySettings();
