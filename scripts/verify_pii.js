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

async function verifyPii() {
    console.log('--- Verifying PII Redaction Module ---');

    // Import handler
    const { default: piiHandler } = await import('../api/pii.js');

    const demoKey = 'ac_live_demo_key_12345';
    const inputText = "Patient John Doe (SSN: 123-45-6789) was admitted on 10/12/2024. Email: john.doe@example.com";

    console.log(`\nInput: "${inputText}"`);

    const req = {
        method: 'POST',
        json: async () => ({ text: inputText, apiKey: demoKey })
    };

    const res = await piiHandler(req);
    const data = await res.json();

    console.log(`Output: "${data.redacted}"`);

    // Verification Checks
    const hasRedactedSSN = data.redacted.includes('[REDACTED: SSN]');
    const hasRedactedEmail = data.redacted.includes('[REDACTED: EMAIL]');
    const hasRedactedDate = data.redacted.includes('[REDACTED: DATE]');
    const hasRedactedPatient = data.redacted.includes('[REDACTED: PATIENT]');

    if (hasRedactedSSN && hasRedactedEmail && hasRedactedDate && hasRedactedPatient) {
        console.log('✅ Verification Successful: All PII types redacted.');
    } else {
        console.error('❌ Verification Failed: Some PII leaked.', data);
    }
}

verifyPii();
