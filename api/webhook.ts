import Stripe from 'stripe';
import crypto from 'crypto';

export const config = {
    runtime: 'nodejs', // Stripe SDK requires Node.js runtime, not Edge
};

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function json(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
        },
    });
}

const getEnv = () => ({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command: string, ...args: string[]): Promise<any> {
    const { url, token } = getEnv();
    if (!url || !token) throw new Error('Upstash not configured');
    const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
    const res = await fetch(`${url}/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = await res.json();
    return data.result;
}

async function sha256Hex(text: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Mock Email Service (Logs to Redis)
async function sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
    const timestamp = new Date().toISOString();
    const emailLog = JSON.stringify({ to, subject, body, timestamp });
    await redis('LPUSH', 'logs:emails', emailLog);
}

/**
 * Stripe Webhook Handler
 */
export default async function handler(req: Request): Promise<Response> {
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const sig = req.headers.get('stripe-signature');
    const body = await req.text();

    let event: Stripe.Event;

    try {
        if (!sig || !STRIPE_WEBHOOK_SECRET) throw new Error('Missing signature or secret');
        event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return json({ error: `Webhook Error: ${err.message}` }, 400);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, stripe);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, stripe);
                break;

            case 'invoice.payment_succeeded':
                console.log('Payment succeeded:', (event.data.object as any).id);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice, stripe);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return json({ received: true });
    } catch (error: any) {
        console.error('Webhook handler error:', error);
        return json({ error: error.message }, 500);
    }
}

/**
 * Handle successful checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
    console.log('Checkout completed:', session.id);

    const customerEmail = session.customer_email;
    const customerId = session.customer as string;

    if (!customerEmail || !customerId) return;

    // Generate API key
    const apiKey = 'ac_live_' + generateSecureToken(32);

    // Get subscription details
    const subscriptionId = session.subscription as string;
    let subscription: any;
    let priceId = '';

    if (subscriptionId.startsWith('sub_test_')) {
        // Mock for testing
        subscription = { items: { data: [{ price: { id: 'price_test_starter', unit_amount: 0 } }] } };
        priceId = 'price_test_starter';
    } else {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
        priceId = subscription.items.data[0].price.id;
    }

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
            // 1. Store API key hash -> email mapping
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
            const quotas: Record<string, number> = { starter: 25000, pro: 150000, business: 500000 };
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
                    'subscriptionId', subscriptionId,
                    'status', 'active',
                    'createdAt', Date.now()
                ])
            });

            console.log('Successfully persisted API key for:', customerEmail);
        } catch (err) {
            console.error('Failed to persist to Redis:', err);
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
        subscriptionId: subscriptionId
    });

    await sendWelcomeEmail(customerEmail, apiKey, plan);

    await sendWelcomeEmail(customerEmail, apiKey, plan);

    if (!customerId.startsWith('cus_test_')) {
        await stripe.customers.update(customerId, {
            metadata: {
                api_key: apiKey,
                plan: plan
            }
        });
    } else {
        console.log('[TEST] Skipped Stripe Customer Update for:', customerId);
    }
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, stripe: Stripe) {
    console.log('Subscription updated:', subscription.id);

    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId) as any; // Cast to any to avoid strict type checks on deleted property

    if (customer.deleted) return;

    const priceId = subscription.items.data[0].price.id;
    let newPlan = 'starter';
    if (priceId.includes('pro') || subscription.items.data[0].price.unit_amount === 9900) {
        newPlan = 'pro';
    } else if (priceId.includes('business') || subscription.items.data[0].price.unit_amount === 29900) {
        newPlan = 'business';
    }

    // We need to find the user's hash to update the plan. 
    // We can look it up from Redis using the customerId if we stored it (we did in handleCheckoutCompleted: customer:{customerId}).

    const apiKeyHash = await redis('HGET', `customer:${customerId}`, 'apiKeyHash');

    if (apiKeyHash) {
        // Update quota based on new plan
        const quotas: Record<string, number> = { starter: 25000, pro: 150000, business: 500000 };
        await redis('SET', `usage:${apiKeyHash}:monthlyQuota`, (quotas[newPlan] || 1000).toString());

        // Update plan in customer record
        await redis('HSET', `customer:${customerId}`, 'plan', newPlan);
    }

    console.log('Plan updated for:', customer.email, 'to:', newPlan);

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
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, stripe: Stripe) {
    console.log('Subscription deleted:', subscription.id);

    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId) as any;

    if (customer.deleted) return;

    const apiKeyHash = await redis('HGET', `customer:${customerId}`, 'apiKeyHash');

    if (apiKeyHash) {
        // Deactivate by deleting the key mapping
        await redis('DEL', `key:${apiKeyHash}`);
        await redis('HSET', `customer:${customerId}`, 'status', 'cancelled');
        console.log('Deactivated API key for:', customer.email);
    }

    await sendCancellationEmail(customer.email || '');
}

/**
 * Handle failed payments
 */
async function handlePaymentFailed(invoice: Stripe.Invoice, stripe: Stripe) {
    console.log('Payment failed:', invoice.id);

    const customerId = invoice.customer as string;
    const customer = await stripe.customers.retrieve(customerId) as any;

    if (customer.deleted) return;

    await sendPaymentFailedEmail(customer.email || '', invoice.amount_due / 100);
}

function generateSecureToken(length: number): string {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

async function sendWelcomeEmail(email: string, apiKey: string, plan: string) {
    console.log(`[EMAIL] Welcome email to ${email}`);
    const emailLog = {
        to: email,
        subject: 'Welcome to AgentCache',
        body: `Welcome to ${plan}. Key: ${apiKey}`,
        timestamp: new Date().toISOString()
    };
    await redis('LPUSH', 'logs:emails', JSON.stringify(emailLog));
}

async function sendCancellationEmail(email: string) {
    console.log(`[EMAIL] Cancellation email to ${email}`);
    const emailLog = {
        to: email,
        subject: 'Subscription Cancelled',
        body: 'Your subscription has been cancelled.',
        timestamp: new Date().toISOString()
    };
    await redis('LPUSH', 'logs:emails', JSON.stringify(emailLog));
}

async function sendPaymentFailedEmail(email: string, amount: number) {
    console.log(`[EMAIL] Payment failed email to ${email}`);
    const emailLog = {
        to: email,
        subject: 'Payment Failed',
        body: `Payment of $${amount} failed.`,
        timestamp: new Date().toISOString()
    };
    await redis('LPUSH', 'logs:emails', JSON.stringify(emailLog));
}
