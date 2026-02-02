import Stripe from 'stripe';

export class BillingManager {
    private stripe: Stripe;
    private initialized: boolean = false;

    constructor(apiKey?: string) {
        const key = apiKey || process.env.STRIPE_SECRET_KEY;
        if (key) {
            this.stripe = new Stripe(key, {
                apiVersion: '2025-01-27.acacia', // Latest as of 2026 dev time
            });
            this.initialized = true;
        } else {
            console.warn('[Billing] No STRIPE_SECRET_KEY found. Billing is disabled (Mock Mode).');
        }
    }

    /**
     * Check if a customer has an active subscription
     */
    async hasActiveSubscription(customerId: string): Promise<boolean> {
        if (!this.initialized) return true; // Dev mode: always active

        try {
            const subs = await this.stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 1
            });
            return subs.data.length > 0;
        } catch (error) {
            console.error('[Billing] Subscription check failed:', error);
            return false;
        }
    }

    /**
     * Report metered usage (e.g. Cache Hits) to Stripe
     */
    async recordUsage(subscriptionItemId: string, quantity: number = 1) {
        if (!this.initialized) {
            console.log(`[Billing] Mock Usage Record: +${quantity} units for ${subscriptionItemId}`);
            return;
        }

        try {
            await this.stripe.subscriptionItems.createUsageRecord(
                subscriptionItemId,
                {
                    quantity: quantity,
                    timestamp: Math.floor(Date.now() / 1000),
                    action: 'increment',
                }
            );
        } catch (error) {
            console.error('[Billing] Usage reporting failed:', error);
            // Don't throw, just log. Billing failure shouldn't crash the agent.
        }
    }

    /**
     * Create a Checkout Session for the "Pro Plan"
     */
    async createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
        if (!this.initialized) throw new Error("Stripe not initialized");

        return await this.stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
        });
    }
}

// Singleton Export
export const billing = new BillingManager();
