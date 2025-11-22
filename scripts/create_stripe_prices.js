import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createPrices() {
    console.log('Creating Stripe Products and Prices...');

    try {
        // 1. Starter Tier: $29/mo
        const starterProduct = await stripe.products.create({
            name: 'AgentCache Starter',
            description: 'For side projects. 100K requests/mo.',
        });
        const starterPrice = await stripe.prices.create({
            product: starterProduct.id,
            unit_amount: 2900, // $29.00
            currency: 'usd',
            recurring: { interval: 'month' },
        });
        console.log(`Created Starter: ${starterPrice.id} ($29/mo)`);

        // 2. Pro Tier: $99/mo
        const proProduct = await stripe.products.create({
            name: 'AgentCache Pro',
            description: 'For production apps. 500K requests/mo.',
        });
        const proPrice = await stripe.prices.create({
            product: proProduct.id,
            unit_amount: 9900, // $99.00
            currency: 'usd',
            recurring: { interval: 'month' },
        });
        console.log(`Created Pro: ${proPrice.id} ($99/mo)`);

        // 3. Business Tier: $299/mo
        const businessProduct = await stripe.products.create({
            name: 'AgentCache Business',
            description: 'For scale-ups. 2M requests/mo.',
        });
        const businessPrice = await stripe.prices.create({
            product: businessProduct.id,
            unit_amount: 29900, // $299.00
            currency: 'usd',
            recurring: { interval: 'month' },
        });
        console.log(`Created Business: ${businessPrice.id} ($299/mo)`);

        console.log('\n--- NEW CONFIGURATION ---');
        console.log(`STRIPE_PRICE_STARTER=${starterPrice.id}`);
        console.log(`STRIPE_PRICE_PRO=${proPrice.id}`);
        console.log(`STRIPE_PRICE_BUSINESS=${businessPrice.id}`);

    } catch (error) {
        console.error('Error creating prices:', error);
    }
}

createPrices();
