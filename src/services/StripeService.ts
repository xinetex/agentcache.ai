/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import Stripe from 'stripe';
import { db } from '../db/client.js';
import { creditTransactions } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

import { ledger } from './LedgerService.js';

/**
 * Stripe Service
 * Bridges the gap between Real Money (USD) and Agent Money (Credits).
 */
export class StripeService {
    private stripe: Stripe;
    private isConfigured: boolean = false;

    constructor() {
        const key = process.env.STRIPE_SECRET_KEY;
        if (key) {
            this.stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' }); // Latest or pinned version
            this.isConfigured = true;
        } else {
            console.warn('[StripeService] Missing STRIPE_SECRET_KEY. Payments disabled.');
        }
    }

    /**
     * Create a Checkout Session for User Top-up
     * Exchange Rate: $1.00 USD = 100 Credits (Example)
     */
    async createTopupSession(userId: string, amountCredits: number) {
        if (!this.isConfigured) throw new Error("Stripe not configured");

        const amountCents = amountCredits * 1; // 1 cent per credit => $1 = 100 credits

        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Agent Credits',
                        description: `Top-up for ${amountCredits} Credits`
                    },
                    unit_amount: amountCents, // Total Price
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard?success=true`,
            cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard?canceled=true`,
            metadata: {
                userId: userId,
                type: 'credit_topup',
                credits: amountCredits.toString()
            }
        });

        return session;
    }

    /**
     * Perform an off-session charge (Auto-topoff)
     */
    async offSessionCharge(userId: string, paymentMethodId: string, amountCredits: number, stripeCustomerId: string) {
        if (!this.isConfigured) throw new Error("Stripe not configured");

        const amountCents = amountCredits * 1;

        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'usd',
            customer: stripeCustomerId,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            metadata: {
                userId,
                credits: amountCredits.toString(),
                type: 'auto_topoff'
            }
        });

        if (paymentIntent.status === 'succeeded') {
            await this.syncTransactionToLedger(userId, amountCredits, `Stripe Auto-topoff: ${paymentIntent.id}`);
            return true;
        }
        return false;
    }

    private async syncTransactionToLedger(userId: string, credits: number, description: string) {
        // Ensure account exists
        await ledger.createAccount(userId, 'user');
        // Deposit to ledger
        await ledger.deposit(userId, credits, description);
    }

    /**
     * Handle Webhook Event (Mockable for tests)
     */
    async handleEvent(event: Stripe.Event) {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId;
            const credits = parseInt(session.metadata?.credits || '0');

            if (userId && credits > 0) {
                console.log(`[Stripe] Payment Success! Funding User ${userId} with ${credits} credits.`);

                // MINT CREDITS (Database Transaction)
                await db.insert(creditTransactions).values({
                    id: uuidv4(),
                    userId: userId,
                    type: 'deposit',
                    amount: credits,
                    balanceAfter: 0, // In reality, we'd fetch current balance + amount
                    description: `Stripe Deposit: ${session.id}`,
                    stripeCheckoutSessionId: session.id
                });

                // Sync with internal ledger
                await this.syncTransactionToLedger(userId, credits, `Stripe Deposit: ${session.id}`);
            }
        }
    }
}

export const stripeService = new StripeService();
