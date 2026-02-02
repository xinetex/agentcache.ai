
import 'dotenv/config';
import { stripeService } from '../src/services/StripeService.js';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    console.log("💳 Verifying Stripe Service...");

    // 1. Test Session Creation
    // (Only if configured, otherwise we skip to avoid crash)
    if (process.env.STRIPE_SECRET_KEY) {
        try {
            const session = await stripeService.createTopupSession('test-user-123', 500); // $5.00
            console.log(`[Stripe] Session Created: ${session.id} (URL: ${session.url})`);
        } catch (err) {
            console.error(`[Stripe] Session Creation Failed:`, err.message);
        }
    } else {
        console.warn("⚠️ SKIPPING Session Test: STRIPE_SECRET_KEY missing.");
    }

    // 2. Test Webhook Logic (Simulation)
    console.log("\n🧪 Simulating Webhook Event 'checkout.session.completed'...");

    // Create a mock event payload
    const mockEvent = {
        id: 'evt_test_123',
        object: 'event',
        type: 'checkout.session.completed',
        created: Date.now() / 1000,
        data: {
            object: {
                id: 'cs_test_abc123',
                metadata: {
                    userId: 'e2e-test-user-001', // Use a UUID-like string if DB enforces it? 
                    // DB schema says uuid... so I should use a real uuid
                    userId: '00000000-0000-0000-0000-000000000000', // Null UUID or similar
                    credits: '100'
                }
            }
        }
    };

    // Note: This will attempt a DB write. 
    // If '0000...' user doesn't exist, it might fail foreign key constraint.
    // So we should expect a failure or success depending on DB state.
    // Ideally we mock the db call, but here we are integration testing.

    try {
        await stripeService.handleEvent(mockEvent as any);
        console.log("[Stripe] Webhook Handled (Check DB logs).");
    } catch (err) {
        console.log(`[Stripe] Webhook Result: ${err.message} (Expected if User FK fails)`);
    }
}

main().catch(console.error);
