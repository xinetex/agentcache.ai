import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Set dummy keys if missing (for testing purposes)
if (!process.env.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
if (!process.env.STRIPE_WEBHOOK_SECRET) process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Mock Stripe to generate signature
const stripe = new Stripe('sk_test_mock', { apiVersion: '2024-11-20.acacia' });

async function runTest() {
    console.log('🧪 Testing Webhook Logic (Unit Test)...');

    // Dynamic import to ensure env vars are loaded first
    const { default: handler } = await import('../api/webhook');

    // 1. Mock Payload
    const payload = {
        id: 'evt_test_unit',
        object: 'event',
        type: 'checkout.session.completed',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: {
                id: 'cs_test_unit_123',
                object: 'checkout.session',
                customer: 'cus_test_unit',
                customer_email: 'unit_test@example.com',
                subscription: 'sub_test_unit',
                mode: 'subscription',
                payment_status: 'paid',
                status: 'complete'
            }
        }
    };
    const payloadString = JSON.stringify(payload, null, 2);

    // 2. Generate Signature
    const sig = stripe.webhooks.generateTestHeaderString({
        payload: payloadString,
        secret: WEBHOOK_SECRET,
    });

    // 3. Mock Request
    const req = new Request('http://localhost/api/webhook', {
        method: 'POST',
        headers: {
            'stripe-signature': sig,
            'content-type': 'application/json'
        },
        body: payloadString
    });

    // 4. Call Handler
    try {
        const res = await handler(req);
        const data = await res.json();

        if (res.status === 200) {
            console.log('✅ Webhook Handler Success:', data);
        } else {
            console.error('❌ Webhook Handler Failed:', res.status, data);
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Exception:', err);
        process.exit(1);
    }
}

runTest();
