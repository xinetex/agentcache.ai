import Stripe from 'stripe';
import crypto from 'crypto';

// Specify Node.js runtime for Stripe SDK compatibility
export const config = {
    runtime: 'nodejs',
};

/**
 * Stripe Webhook Handler
 * Handles subscription events and manages API keys
 */
export default async function handler(req, res) {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const sig = req.headers['stripe-signature'];

    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                console.log('Payment succeeded:', event.data.object.id);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Handle successful checkout - Generate and send API key
 */
async function handleCheckoutCompleted(session) {
    console.log('Checkout completed:', session.id);

    const customerEmail = session.customer_email;
    const customerId = session.customer;

    // Generate API key
    const apiKey = 'ac_live_' + generateSecureToken(32);

    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const priceId = subscription.items.data[0].price.id;

    // Determine plan tier
    let plan = 'starter';
    if (priceId.includes('pro') || subscription.items.data[0].price.unit_amount === 9900) {
        plan = 'pro';
    } else if (priceId.includes('business') || subscription.items.data[0].price.unit_amount === 29900) {
        plan = 'business';
    }

    // Store in Upstash Redis
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (UPSTASH_URL && UPSTASH_TOKEN) {
        try {
            // 1. Store API key hash -> email mapping (for auth verification)
            const enc = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKey));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

            await fetch(`${UPSTASH_URL}/hset/key:${hash}/email`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
                body: JSON.stringify(customerEmail)
            });

            // 2. Store Usage/Quota info
            const quotas = { starter: 25000, pro: 150000, business: 500000 };
            await fetch(`${UPSTASH_URL}/set/usage:${hash}/monthlyQuota`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
                body: JSON.stringify(quotas[plan] || 1000)
            });

            // 3. Store Customer Metadata
            await fetch(`${UPSTASH_URL}/hset/customer:${customerId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify([
                    'email', customerEmail,
                    'apiKeyHash', hash,
                    'plan', plan,
                    'subscriptionId', session.subscription,
                    'status', 'active',
                    'createdAt', Date.now()
                ])
            });

            console.log('Successfully persisted API key for:', customerEmail);
        } catch (err) {
            console.error('Failed to persist to Redis:', err);
            // Fallback: Log CRITICAL error so we can manually recover
            console.error('CRITICAL: API Key generated but not saved:', { email: customerEmail, apiKey, plan });
        }
    } else {
        console.error('CRITICAL: Upstash credentials missing. API Key not saved.');
    }

    console.log('New subscription:', {
        email: customerEmail,
        apiKey: apiKey,
        plan: plan,
        customerId: customerId,
        subscriptionId: session.subscription
    });

    // Send email with API key
    await sendWelcomeEmail(customerEmail, apiKey, plan);

    // Update customer metadata in Stripe with API key
    await stripe.customers.update(customerId, {
        metadata: {
            api_key: apiKey,
            plan: plan
        }
    });
}

/**
 * Handle subscription updates (plan changes)
 */
async function handleSubscriptionUpdated(subscription) {
    console.log('Subscription updated:', subscription.id);

    const customerId = subscription.customer;
    const customer = await stripe.customers.retrieve(customerId);

    // Get new plan tier
    const priceId = subscription.items.data[0].price.id;
    let newPlan = 'starter';
    if (priceId.includes('pro') || subscription.items.data[0].price.unit_amount === 9900) {
        newPlan = 'pro';
    } else if (priceId.includes('business') || subscription.items.data[0].price.unit_amount === 29900) {
        newPlan = 'business';
    }

    // Update plan in database
    await redis('HSET', `user:${userId}`, 'plan', newPlan);

    // Log the change
    await redis('LPUSH', `history:${userId}`, JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'plan_updated',
        details: { from: currentPlan, to: newPlan }
    }));
    console.log('Plan updated for:', customer.email, 'to:', newPlan);

    // Update Stripe customer metadata
    await stripe.customers.update(customerId, {
        metadata: {
            ...customer.metadata,
            plan: newPlan
        }
    });
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionDeleted(subscription) {
    console.log('Subscription deleted:', subscription.id);

    const customerId = subscription.customer;
    const customer = await stripe.customers.retrieve(customerId);

    // Deactivate API key in database
    // We delete the key mapping so it no longer resolves to the user
    if (apiKey) {
        const hash = await sha256Hex(apiKey);
        await redis('DEL', `key:${hash}`);
        await redis('HDEL', `user:${userId}`, 'active_key');
    }
    console.log('Deactivating API key for:', customer.email);

    // Send cancellation email
    await sendCancellationEmail(customer.email);
}

/**
 * Handle failed payments
 */
async function handlePaymentFailed(invoice) {
    console.log('Payment failed:', invoice.id);

    const customerId = invoice.customer;
    const customer = await stripe.customers.retrieve(customerId);

    // Send payment failed email
    await sendPaymentFailedEmail(customer.email, invoice.amount_due / 100);
}

/**
 * Generate cryptographically secure API key
 */
function generateSecureToken(length) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Send welcome email with API key
 * TODO: Integrate with SendGrid, Postmark, or Resend
 */
async function sendWelcomeEmail(email, apiKey, plan) {
    console.log(`[EMAIL] Welcome email to ${email}:`);
    console.log(`Subject: Welcome to AgentCache! Here's your API key`);
    console.log(`Body:`);
    console.log(`Hi there!`);
    console.log(``);
    console.log(`Welcome to AgentCache ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`);
    console.log(``);
    console.log(`Your API Key: ${apiKey}`);
    console.log(``);
    console.log(`Get started in 60 seconds:`);
    console.log(`1. Install: pip install agentcache`);
    console.log(`2. Use your API key in your code`);
    console.log(`3. Start saving 80-90% on LLM costs!`);
    console.log(``);
    console.log(`Documentation: https://agentcache.ai/docs.html`);
    console.log(``);
    console.log(`Need help? Reply to this email or visit https://agentcache.ai/contact.html`);

    // Mock Email Service (Log to Redis for verification)
    const emailLog = {
        to: email,
        subject: 'Invoice Paid',
        body: `Thank you for your payment of $${amount / 100}.`,
        timestamp: new Date().toISOString()
    };
    await redis('LPUSH', 'system:emails', JSON.stringify(emailLog));
    console.log(`[MockEmail] Sent to ${email}: ${emailLog.subject}`);
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'hello@agentcache.ai',
    //   to: email,
    //   subject: 'Welcome to AgentCache! Here\'s your API key',
    //   html: emailTemplate
    // });
}

/**
 * Send cancellation email
 */
async function sendCancellationEmail(email) {
    console.log(`[EMAIL] Cancellation email to ${email}`);
    // Mock Email Service (Log to Redis for verification)
    const emailLog = {
        to: email,
        subject: 'Subscription Cancelled',
        body: 'Your subscription has been cancelled.',
        timestamp: new Date().toISOString()
    };
    await redis('LPUSH', 'system:emails', JSON.stringify(emailLog));
    console.log(`[MockEmail] Sent to ${email}: ${emailLog.subject}`);
}

/**
 * Send payment failed email
 */
async function sendPaymentFailedEmail(email, amount) {
    console.log(`[EMAIL] Payment failed email to ${email} for $${amount}`);
    // Mock Email Service (Log to Redis for verification)
    const emailLog = {
        to: email,
        subject: 'Payment Failed',
        body: `Your payment of $${amount} failed. Please update your payment method.`,
        timestamp: new Date().toISOString()
    };
    await redis('LPUSH', 'system:emails', JSON.stringify(emailLog));
    console.log(`[MockEmail] Sent to ${email}: ${emailLog.subject}`);
}
