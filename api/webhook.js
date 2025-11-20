const Stripe = require('stripe');
const crypto = require('crypto');

/**
 * Stripe Webhook Handler
 * Handles subscription events and manages API keys
 */
module.exports = async (req, res) => {
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

    // TODO: Store in database
    // For now, we'll just log it. You'll need to integrate with Upstash Redis or your DB
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

    // TODO: Update plan in database
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

    // TODO: Deactivate API key in database
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

    // TODO: Actually send email via email service
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
    // TODO: Implement with email service
}

/**
 * Send payment failed email
 */
async function sendPaymentFailedEmail(email, amount) {
    console.log(`[EMAIL] Payment failed email to ${email} for $${amount}`);
    // TODO: Implement with email service
}
