import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Mock Stripe instance for signature generation
const stripe = new Stripe('sk_test_mock', { apiVersion: '2024-11-20.acacia' });

async function runVerification() {
    console.log('💳 Starting Payment Flow Verification...');
    console.log(`Target: ${API_URL}`);

    if (!WEBHOOK_SECRET) {
        console.warn('⚠️ STRIPE_WEBHOOK_SECRET not found in .env. Skipping webhook signature test.');
        console.warn('   (Cannot verify webhook endpoint without the secret to sign the payload)');
        return;
    }

    // 1. Construct Mock Event
    const payload = {
        id: 'evt_test_webhook',
        object: 'event',
        type: 'checkout.session.completed',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: {
                id: 'cs_test_123',
                object: 'checkout.session',
                customer: 'cus_test_user',
                customer_email: 'test_user@example.com',
                subscription: 'sub_test_123',
                mode: 'subscription',
                payment_status: 'paid',
                status: 'complete'
            }
        }
    };

    const payloadString = JSON.stringify(payload, null, 2);

    // 2. Generate Signature
    const header = stripe.webhooks.generateTestHeaderString({
        payload: payloadString,
        secret: WEBHOOK_SECRET,
    });

    // 3. Send Webhook
    console.log('\n1. Sending Mock Webhook...');
    const res = await fetch(`${API_URL}/api/webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Stripe-Signature': header
        },
        body: payloadString
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('❌ Webhook Failed:', err);
        process.exit(1);
    }

    const data = await res.json();
    console.log('✅ Webhook Accepted:', data);

    // 4. Verify Key Provisioning (via Auth API)
    // Since we don't know the generated key (it was "emailed"), we can't easily login.
    // BUT, we can check if the user was created if we had admin access.
    // For this test, we'll rely on the webhook acceptance and the logs we see in the server console.

    console.log('\n✨ Payment Verification Complete!');
    console.log('   Check server logs for "Successfully persisted API key" and "[EMAIL] Welcome email"');
}

runVerification().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
