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

async function verifyIntegrations() {
    console.log('--- Verifying Integrations Module ---');

    // Import handlers
    const { default: integrationsHandler } = await import('../api/integrations.js');
    const { triggerWebhook } = await import('../api/webhook-trigger.js');

    const demoKey = 'ac_live_demo_key_12345';

    // 1. Save Webhook URL
    console.log('\n1. Saving Webhook URL...');
    const testUrl = 'https://webhook.site/test-verification-url'; // Mock URL
    const saveReq = {
        method: 'POST',
        json: async () => ({ apiKey: demoKey, webhookUrl: testUrl })
    };
    const saveRes = await integrationsHandler(saveReq);
    const saveData = await saveRes.json();

    if (saveData.success) {
        console.log('✅ Webhook URL saved');
    } else {
        console.error('❌ Failed to save webhook URL', saveData);
        return;
    }

    // 2. Verify Retrieval
    console.log('\n2. Verifying Retrieval...');
    const getReq = {
        method: 'GET',
        url: `http://localhost/api/integrations?apiKey=${demoKey}`,
        json: async () => ({})
    };
    const getRes = await integrationsHandler(getReq);
    const getData = await getRes.json();

    if (getData.webhookUrl === testUrl) {
        console.log('✅ Webhook URL retrieved correctly');
    } else {
        console.error('❌ Webhook URL mismatch', getData);
    }

    // 3. Simulate Trigger (Mocking fetch to avoid actual network call to dummy URL)
    console.log('\n3. Simulating Webhook Trigger...');

    // Mock global fetch for this test
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        if (url === testUrl) {
            console.log('   [MockFetch] POST received at', url);
            return { ok: true, status: 200, json: async () => ({}) };
        }
        return originalFetch(url, options);
    };

    // Calculate hash manually to match what triggerWebhook expects (since we pass hash, not key)
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(demoKey));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const demoHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

    const result = await triggerWebhook(demoHash, 'test_event', { foo: 'bar' });

    if (result.triggered) {
        console.log('✅ Webhook triggered successfully');
    } else {
        console.error('❌ Webhook failed to trigger', result);
    }

    // Restore fetch
    global.fetch = originalFetch;
}

verifyIntegrations();
